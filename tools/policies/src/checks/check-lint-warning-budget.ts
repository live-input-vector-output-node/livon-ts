import path from 'node:path';
import { collectProjects, readJson } from '../shared/fs-utils.ts';
import type { PackageJsonLike, PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface LintWarningBudgetConfig {
  readonly version: number;
  readonly budgets: Record<string, number>;
}

const ESLINT_SCRIPT_PATTERN = /\beslint\b/;
const MAX_WARNINGS_PATTERN = /(?:^|\s)--max-warnings(?:=|\s+)(-?\d+)(?:\s|$)/;

const readLintWarningBudget = async (
  configPath: string,
): Promise<LintWarningBudgetConfig | null> => {
  const config = await readJson<LintWarningBudgetConfig>(configPath).catch(() => null);
  if (!config || typeof config.version !== 'number' || !config.budgets || typeof config.budgets !== 'object') {
    return null;
  }
  return config;
};

const parseMaxWarnings = (lintScript: string): number | null => {
  const match = lintScript.match(MAX_WARNINGS_PATTERN);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(value) ? value : null;
};

export const runLintWarningBudgetCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];

  const config = await readLintWarningBudget(context.lintWarningBudgetConfigPath);
  if (!config) {
    return {
      id: 'lint-warning-budget',
      errors: ['configs/quality/lint-warning-budgets.json: invalid or unreadable JSON'],
    };
  }

  const allProjects = [
    ...(await collectProjects(context.appsDir)),
    ...(await collectProjects(context.packagesDir)),
    ...(await collectProjects(context.toolsDir)),
  ];

  const lintPackageNames = new Set<string>();

  await Promise.all(
    allProjects.map(async (projectPath) => {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const pkgJson = await readJson<PackageJsonLike>(packageJsonPath).catch(() => null);
      const relativePath = path.relative(context.baseDir, packageJsonPath);

      if (!pkgJson || typeof pkgJson.name !== 'string') {
        errors.push(`${relativePath}: package.json must include a valid "name"`);
        return;
      }

      const lintScript = pkgJson.scripts?.lint;
      if (typeof lintScript !== 'string' || !ESLINT_SCRIPT_PATTERN.test(lintScript)) {
        return;
      }

      lintPackageNames.add(pkgJson.name);

      const expectedBudget = config.budgets[pkgJson.name];
      if (!Number.isInteger(expectedBudget) || expectedBudget < 0) {
        errors.push(`configs/quality/lint-warning-budgets.json: missing non-negative budget for ${pkgJson.name}`);
        return;
      }

      const actualBudget = parseMaxWarnings(lintScript);
      if (actualBudget === null) {
        errors.push(`${relativePath}: lint script must include "--max-warnings ${expectedBudget}"`);
        return;
      }

      if (actualBudget !== expectedBudget) {
        errors.push(
          `${relativePath}: lint script max-warnings (${actualBudget}) must match budget config (${expectedBudget}) for ${pkgJson.name}`,
        );
      }
    }),
  );

  const staleBudgets = Object.keys(config.budgets)
    .filter((packageName) => !lintPackageNames.has(packageName))
    .sort((left, right) => left.localeCompare(right));

  staleBudgets.forEach((packageName) => {
    errors.push(`configs/quality/lint-warning-budgets.json: stale budget entry for ${packageName}`);
  });

  return {
    id: 'lint-warning-budget',
    errors,
    info: [
      `lintPackages=${lintPackageNames.size}`,
      `budgetEntries=${Object.keys(config.budgets).length}`,
      `version=${config.version}`,
    ],
  };
};
