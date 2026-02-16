import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIRECTORY = process.cwd();
const ROOT_PACKAGE_JSON_PATH = path.join(ROOT_DIRECTORY, 'package.json');

const WORKSPACE_PACKAGE_JSON_PATHS = [
  'apps/client/package.json',
  'apps/server/package.json',
  'packages/cli/package.json',
  'packages/client/package.json',
  'packages/client-ws-transport/package.json',
  'packages/config/package.json',
  'packages/dlq-module/package.json',
  'packages/runtime/package.json',
  'packages/schema/package.json',
  'packages/server-ws-transport/package.json',
  'tools/rslib-browser/package.json',
  'tools/rslib-node/package.json',
  'tools/rslib-package/package.json',
  'tools/rspack-app/package.json',
  'tools/rsstack-app/package.json',
  'tools/rsstack-frontend/package.json',
  'website/package.json',
].map((relativePath) => path.join(ROOT_DIRECTORY, relativePath));

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const run = async () => {
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
