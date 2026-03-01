import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const resolveWorkspaceRoot = (startDir = process.cwd()) => {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return path.resolve(startDir);
};

const ROOT_DIRECTORY = resolveWorkspaceRoot();
const ROOT_PACKAGE_JSON_PATH = path.join(ROOT_DIRECTORY, 'package.json');

const collectWorkspacePackageJsonPaths = async () => {
  const scopedPackageRoots = ['apps', 'packages', 'tools'];
  const scopedPaths = await Promise.all(
    scopedPackageRoots.map(async (rootName) => {
      const rootPath = path.join(ROOT_DIRECTORY, rootName);
      const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootPath, entry.name, 'package.json'));
    }),
  );

  return [
    ...scopedPaths.flat(),
    path.join(ROOT_DIRECTORY, 'website', 'package.json'),
  ];
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const run = async () => {
  const WORKSPACE_PACKAGE_JSON_PATHS = await collectWorkspacePackageJsonPaths();
  const workspacePackages = await Promise.all(
    WORKSPACE_PACKAGE_JSON_PATHS.map(async (filePath) => {
      const json = await readJson(filePath);
      return {
        filePath,
        name: json.name,
        version: json.version,
      };
    }),
  );

  const uniqueVersions = Array.from(new Set(workspacePackages.map((pkg) => pkg.version)));

  if (uniqueVersions.length !== 1) {
    const details = workspacePackages
      .map((pkg) => `${path.relative(ROOT_DIRECTORY, pkg.filePath)}: ${pkg.version}`)
      .join('\n');
    throw new Error(
      `Cannot sync root version because workspace versions differ.\n${details}`,
    );
  }

  const targetVersion = uniqueVersions[0];
  const rootPackageJson = await readJson(ROOT_PACKAGE_JSON_PATH);

  if (rootPackageJson.version === targetVersion) {
    process.stdout.write(`Root version already synced at ${targetVersion}.\n`);
    return;
  }

  const nextRootPackageJson = {
    ...rootPackageJson,
    version: targetVersion,
  };

  await writeFile(
    ROOT_PACKAGE_JSON_PATH,
    `${JSON.stringify(nextRootPackageJson, null, 2)}\n`,
    'utf8',
  );

  process.stdout.write(`Synced root package.json version to ${targetVersion}.\n`);
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
