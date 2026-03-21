import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectFiles } from '../shared/fs-utils.ts';
import { normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const AGENTS_FILE_NAME = 'AGENTS.md';

const AGENT_LOAD_PATTERN = /<!--\s*@agent\.load:\s*([^>\n]+)\s*-->/g;

const findNearestParentAgent = (agentPath: string, knownAgents: ReadonlySet<string>): string | null => {
  const parentDir = normalizePath(path.dirname(path.dirname(agentPath)));
  let cursorDir = parentDir;

  while (cursorDir !== '.' && cursorDir !== '') {
    const candidate = normalizePath(path.join(cursorDir, AGENTS_FILE_NAME));
    if (knownAgents.has(candidate)) {
      return candidate;
    }
    const nextCursor = normalizePath(path.dirname(cursorDir));
    if (nextCursor === cursorDir) {
      break;
    }
    cursorDir = nextCursor;
  }

  return knownAgents.has(AGENTS_FILE_NAME) ? AGENTS_FILE_NAME : null;
};

const resolveLoadTargets = (context: PolicyContext, agentPath: string, source: string): string[] => {
  const agentAbsolutePath = path.join(context.baseDir, agentPath);
  return [...source.matchAll(AGENT_LOAD_PATTERN)].map((match) => {
    const rawTarget = match[1].trim();
    const targetAbsolutePath = path.resolve(path.dirname(agentAbsolutePath), rawTarget);
    return normalizePath(path.relative(context.baseDir, targetAbsolutePath));
  });
};

export const runAiInstructionHierarchyCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];
  const info: string[] = [];

  const allFiles = await collectFiles(context.baseDir);
  const agentFiles = allFiles
    .filter((absolutePath) => path.basename(absolutePath) === AGENTS_FILE_NAME)
    .map((absolutePath) => normalizePath(path.relative(context.baseDir, absolutePath)))
    .sort((left, right) => left.split('/').length - right.split('/').length);

  if (agentFiles.length === 0) {
    return {
      id: 'ai-instruction-hierarchy',
      errors: ['AGENTS.md: no AGENTS files found'],
    };
  }

  const knownAgents = new Set(agentFiles);
  if (!knownAgents.has(AGENTS_FILE_NAME)) {
    errors.push('AGENTS.md: root AGENTS.md is required for hierarchical inheritance');
  }

  await Promise.all(
    agentFiles.map(async (agentPath) => {
      const absolutePath = path.join(context.baseDir, agentPath);
      const source = await readFile(absolutePath, 'utf8').catch(() => null);
      if (!source) {
        errors.push(`${agentPath}: unable to read AGENTS file`);
        return;
      }

      if (!source.includes('@agent.entry')) {
        errors.push(`${agentPath}: missing @agent.entry marker`);
      }

      if (agentPath === AGENTS_FILE_NAME) {
        return;
      }

      const expectedParent = findNearestParentAgent(agentPath, knownAgents);
      if (!expectedParent) {
        errors.push(`${agentPath}: unable to resolve parent AGENTS file`);
        return;
      }

      const resolvedTargets = resolveLoadTargets(context, agentPath, source);
      if (!resolvedTargets.includes(expectedParent)) {
        errors.push(
          `${agentPath}: missing @agent.load to nearest parent AGENTS (${expectedParent}) for hierarchical inheritance`,
        );
      }
    }),
  );

  info.push(`agents=${agentFiles.length}`);

  return {
    id: 'ai-instruction-hierarchy',
    errors,
    info,
  };
};
