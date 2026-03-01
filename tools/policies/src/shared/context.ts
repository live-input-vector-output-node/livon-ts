import path from 'node:path';
import type { PolicyContext } from './types.ts';
import { resolveWorkspaceBaseDir } from './workspace-root.ts';

export const createPolicyContext = (rootDir: string = process.cwd()): PolicyContext => {
  const baseDir = resolveWorkspaceBaseDir(rootDir);

  return {
    rootDir,
    baseDir,
    packagesDir: path.join(baseDir, 'packages'),
    appsDir: path.join(baseDir, 'apps'),
    toolsDir: path.join(baseDir, 'tools'),
    websiteDir: path.join(baseDir, 'website'),
    githubDir: path.join(baseDir, '.github'),
    rootPackageJsonPath: path.join(baseDir, 'package.json'),
    rootAgentsPath: path.join(baseDir, 'AGENTS.md'),
    aiRoutingConfigPath: path.join(baseDir, 'configs', 'ai', 'context-routing.json'),
    aiActiveRulesDocPath: path.join(baseDir, 'website', 'docs', 'ai', 'active-rules-and-gates.md'),
    aiRootGateConfigPath: path.join(baseDir, 'configs', 'ai', 'root-gate.json'),
    aiRootGateDocPath: path.join(baseDir, 'website', 'docs', 'ai', 'root-gate.md'),
    aiSpecializationsConfigPath: path.join(baseDir, 'configs', 'ai', 'specializations.json'),
    aiSpecializationsDocPath: path.join(baseDir, 'website', 'docs', 'ai', 'specializations.md'),
    lintWarningBudgetConfigPath: path.join(baseDir, 'configs', 'quality', 'lint-warning-budgets.json'),
  };
};
