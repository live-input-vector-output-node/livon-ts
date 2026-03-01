import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectFiles, exists } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface WorkflowActionUsage {
  readonly action: string;
  readonly ref: string;
  readonly normalizedRef: string;
  readonly workflowPath: string;
  readonly lineNumber: number;
}

const WORKFLOW_FILE_PATTERN = /\.ya?ml$/i;
const GITHUB_ACTION_REF_PATTERN = /^([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?)@([^\s#]+)(?:\s*#\s*(.*))?$/;
const SHA_REF_PATTERN = /^[a-f0-9]{40}$/i;
const SEMVER_TAG_PATTERN = /^v[0-9]+(?:\.[0-9]+){0,2}$/;
const COMMENT_SEMVER_PATTERN = /\bv[0-9]+(?:\.[0-9]+){0,2}\b/;

const normalizeRef = (ref: string, comment: string): string => {
  if (SEMVER_TAG_PATTERN.test(ref)) {
    return ref;
  }

  if (SHA_REF_PATTERN.test(ref)) {
    const match = comment.match(COMMENT_SEMVER_PATTERN);
    if (match) {
      return match[0];
    }
  }

  return ref;
};

const parseWorkflowActionUsages = (source: string, workflowPath: string): WorkflowActionUsage[] => {
  const usages: WorkflowActionUsage[] = [];
  const lines = source.split('\n');

  lines.forEach((line, index) => {
    const usesMatch = line.match(/^\s*uses:\s*(.+?)\s*$/);
    if (!usesMatch) {
      return;
    }

    const rawActionRef = usesMatch[1]?.trim();
    if (!rawActionRef || rawActionRef.startsWith('./') || rawActionRef.startsWith('docker://')) {
      return;
    }

    const parsed = rawActionRef.match(GITHUB_ACTION_REF_PATTERN);
    if (!parsed) {
      return;
    }

    const action = parsed[1] ?? '';
    const ref = parsed[2] ?? '';
    const comment = parsed[3] ?? '';
    if (!action || !ref) {
      return;
    }

    usages.push({
      action,
      ref,
      normalizedRef: normalizeRef(ref, comment),
      workflowPath,
      lineNumber: index + 1,
    });
  });

  return usages;
};

export const runWorkflowActionVersionConsistencyCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const workflowsDir = path.join(context.githubDir, 'workflows');
  if (!(await exists(workflowsDir))) {
    return {
      id: 'workflow-action-version-consistency',
      errors: [],
      info: ['workflows=0', 'actions=0'],
    };
  }

  const workflowFiles = (await collectFiles(workflowsDir))
    .filter((filePath) => WORKFLOW_FILE_PATTERN.test(filePath))
    .sort();

  const usagesByAction = new Map<string, WorkflowActionUsage[]>();

  for (const workflowFile of workflowFiles) {
    const source = await readFile(workflowFile, 'utf8').catch(() => null);
    if (source === null) {
      return {
        id: 'workflow-action-version-consistency',
        errors: [`${path.relative(context.baseDir, workflowFile)}: unable to read workflow file`],
      };
    }

    const workflowPath = path.relative(context.baseDir, workflowFile);
    const parsedUsages = parseWorkflowActionUsages(source, workflowPath);

    parsedUsages.forEach((usage) => {
      const existing = usagesByAction.get(usage.action) ?? [];
      existing.push(usage);
      usagesByAction.set(usage.action, existing);
    });
  }

  const errors: string[] = [];

  [...usagesByAction.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .forEach(([action, usages]) => {
      const variants = new Map<string, WorkflowActionUsage[]>();
      usages.forEach((usage) => {
        const existing = variants.get(usage.normalizedRef) ?? [];
        existing.push(usage);
        variants.set(usage.normalizedRef, existing);
      });

      if (variants.size <= 1) {
        return;
      }

      const variantSummary = [...variants.entries()]
        .map(([normalizedRef, variantUsages]) => {
          const refs = [...new Set(variantUsages.map((entry) => entry.ref))].sort().join(', ');
          const locations = variantUsages
            .map((entry) => `${entry.workflowPath}:${entry.lineNumber}`)
            .sort()
            .join(', ');
          return `${normalizedRef} (raw: ${refs}) [${locations}]`;
        })
        .join(' | ');

      errors.push(`workflows: action "${action}" uses inconsistent versions -> ${variantSummary}`);
    });

  return {
    id: 'workflow-action-version-consistency',
    errors,
    info: [`workflows=${workflowFiles.length}`, `actions=${usagesByAction.size}`],
  };
};
