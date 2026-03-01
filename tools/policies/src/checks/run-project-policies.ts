import path from 'node:path';
import {
  REQUIRED_APP_SCRIPTS,
  REQUIRED_LIB_SCRIPTS,
  REQUIRED_PACKAGE_FIELDS,
} from '../shared/constants.ts';
import { collectProjects, readJson } from '../shared/fs-utils.ts';
import type { PackageJsonLike, PolicyCheckResult, PolicyContext } from '../shared/types.ts';
import { checkEslint } from './project/check-eslint.ts';
import { checkForbiddenManualValidationHelpers } from './project/check-forbidden-manual-validation-helpers.ts';
import { checkPackageMeta } from './project/check-package-meta.ts';
import { checkRequiredScripts } from './project/check-required-scripts.ts';
import { checkTsconfig } from './project/check-tsconfig.ts';

const runProjectChecks = async (
  projectPath: string,
  requiredScripts: readonly string[],
  context: PolicyContext,
): Promise<string[]> => {
  const errors: string[] = [];
  const packageJsonPath = path.join(projectPath, 'package.json');
  const pkgJson = await readJson<PackageJsonLike>(packageJsonPath).catch(() => null);

  if (!pkgJson) {
    return [`${projectPath}: package.json is missing or invalid JSON`];
  }

  errors.push(...checkPackageMeta(pkgJson, projectPath, REQUIRED_PACKAGE_FIELDS));
  errors.push(...checkRequiredScripts(pkgJson, requiredScripts, projectPath));
  errors.push(...(await checkTsconfig(projectPath)));
  errors.push(...(await checkEslint(projectPath)));
  errors.push(...(await checkForbiddenManualValidationHelpers(projectPath, context.baseDir)));

  return errors;
};

export const runProjectPoliciesCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const packageProjects = await collectProjects(context.packagesDir);
  const appProjects = await collectProjects(context.appsDir);

  const packageErrors = await Promise.all(
    packageProjects.map((projectPath) => runProjectChecks(projectPath, REQUIRED_LIB_SCRIPTS, context)),
  );
  const appErrors = await Promise.all(
    appProjects.map((projectPath) => runProjectChecks(projectPath, REQUIRED_APP_SCRIPTS, context)),
  );

  return {
    id: 'project-policies',
    errors: [...packageErrors.flat(), ...appErrors.flat()],
    info: [
      `packages=${packageProjects.length}`,
      `apps=${appProjects.length}`,
    ],
  };
};
