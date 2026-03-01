import path from 'node:path';
import { collectProjects, exists, readJson } from '../shared/fs-utils.ts';
import type { PackageJsonLike, PolicyCheckResult, PolicyContext } from '../shared/types.ts';

export const runVersionParityCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];

  const rootPackageJson = await readJson<PackageJsonLike>(context.rootPackageJsonPath).catch(() => null);
  if (!rootPackageJson || typeof rootPackageJson.version !== 'string') {
    return {
      id: 'version-parity',
      errors: ['package.json: root version must be defined as a string'],
    };
  }

  const expectedVersion = rootPackageJson.version;
  const packageProjects = await collectProjects(context.packagesDir);
  const appProjects = await collectProjects(context.appsDir);
  const toolProjects = await collectProjects(context.toolsDir);
  const websiteProjects = (await exists(path.join(context.websiteDir, 'package.json'))) ? [context.websiteDir] : [];

  const packageJsonPaths = [
    context.rootPackageJsonPath,
    ...packageProjects.map((projectPath) => path.join(projectPath, 'package.json')),
    ...appProjects.map((projectPath) => path.join(projectPath, 'package.json')),
    ...toolProjects.map((projectPath) => path.join(projectPath, 'package.json')),
    ...websiteProjects.map((projectPath) => path.join(projectPath, 'package.json')),
  ];

  const checks = await Promise.all(
    packageJsonPaths.map(async (packageJsonPath) => {
      const pkgJson = await readJson<PackageJsonLike>(packageJsonPath).catch(() => null);
      const relativePath = path.relative(context.baseDir, packageJsonPath);

      if (!pkgJson || typeof pkgJson.version !== 'string') {
        return [`${relativePath}: version must be defined as a string`];
      }

      if (pkgJson.version !== expectedVersion) {
        return [
          `${relativePath}: version \"${pkgJson.version}\" must match root package.json version \"${expectedVersion}\"`,
        ];
      }

      return [];
    }),
  );

  errors.push(...checks.flat());

  return {
    id: 'version-parity',
    errors,
    info: [`expected=${expectedVersion}`],
  };
};
