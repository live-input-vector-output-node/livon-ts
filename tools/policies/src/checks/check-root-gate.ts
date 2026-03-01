import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { exists, readJson } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface RootGateRule {
  readonly id: string;
  readonly statement: string;
  readonly humanSources?: string[];
  readonly agentSources?: string[];
}

interface RootGateConfig {
  readonly version: number;
  readonly rules: RootGateRule[];
}

const hasUniqueRuleIds = (rules: readonly RootGateRule[]): string[] => {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  rules.forEach((rule) => {
    if (seen.has(rule.id)) {
      duplicates.push(rule.id);
      return;
    }
    seen.add(rule.id);
  });

  return [...new Set(duplicates)];
};

export const runRootGateCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];
  const info: string[] = [];

  const config = await readJson<RootGateConfig>(context.aiRootGateConfigPath).catch(() => null);
  if (!config) {
    return {
      id: 'root-gate',
      errors: ['configs/ai/root-gate.json: invalid or unreadable JSON'],
    };
  }

  if (!Array.isArray(config.rules) || config.rules.length === 0) {
    return {
      id: 'root-gate',
      errors: ['configs/ai/root-gate.json: rules must be a non-empty array'],
    };
  }

  const duplicateIds = hasUniqueRuleIds(config.rules);
  if (duplicateIds.length > 0) {
    errors.push(`configs/ai/root-gate.json: duplicate rule ids (${duplicateIds.join(', ')})`);
  }

  const docSource = await readFile(context.aiRootGateDocPath, 'utf8').catch(() => null);
  if (!docSource) {
    errors.push('website/docs/ai/root-gate.md: unable to read root gate doc');
  }

  const sourceFileChecks = await Promise.all(
    config.rules.flatMap((rule) => {
      const sourcePaths = [...(rule.humanSources ?? []), ...(rule.agentSources ?? [])];
      return sourcePaths.map(async (relativePath) => {
        const absolutePath = path.join(context.baseDir, relativePath);
        return (await exists(absolutePath))
          ? null
          : `configs/ai/root-gate.json: source path does not exist (${rule.id} -> ${relativePath})`;
      });
    }),
  );
  errors.push(...sourceFileChecks.filter((entry): entry is string => entry !== null));

  config.rules.forEach((rule) => {
    if (typeof rule.id !== 'string' || rule.id.trim().length === 0) {
      errors.push('configs/ai/root-gate.json: each rule must define a non-empty id');
      return;
    }

    if (typeof rule.statement !== 'string' || rule.statement.trim().length === 0) {
      errors.push(`configs/ai/root-gate.json: rule ${rule.id} must define a non-empty statement`);
    }

    if (docSource && !docSource.includes(`\`${rule.id}\``)) {
      errors.push(`website/docs/ai/root-gate.md: missing rule id marker for ${rule.id}`);
    }
  });

  const promptSource = await readFile(path.join(context.baseDir, 'PROMPT.md'), 'utf8').catch(() => '');
  const agentsSource = await readFile(context.rootAgentsPath, 'utf8').catch(() => '');

  if (!promptSource.includes('/docs/ai/root-gate')) {
    errors.push('PROMPT.md: must reference /docs/ai/root-gate as canonical recurring rule source');
  }

  if (!agentsSource.includes('/docs/ai/root-gate')) {
    errors.push('AGENTS.md: must reference /docs/ai/root-gate as canonical recurring rule source');
  }

  info.push(`rules=${config.rules.length}`, `version=${config.version}`);

  return {
    id: 'root-gate',
    errors,
    info,
  };
};
