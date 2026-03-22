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

const parseVersion = (input) => {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(input);
  if (!match) {
    throw new Error(`Unsupported version format: ${input}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : [],
    raw: input,
  };
};

const comparePrereleaseIdentifiers = (left, right) => {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);

  if (leftIsNumeric && rightIsNumeric) {
    return Number(left) - Number(right);
  }

  if (leftIsNumeric) {
    return -1;
  }

  if (rightIsNumeric) {
    return 1;
  }

  return left.localeCompare(right);
};

const compareVersions = (leftInput, rightInput) => {
  const left = parseVersion(leftInput);
  const right = parseVersion(rightInput);

  if (left.major !== right.major) {
    return left.major - right.major;
  }

  if (left.minor !== right.minor) {
    return left.minor - right.minor;
  }

  if (left.patch !== right.patch) {
    return left.patch - right.patch;
  }

  if (left.prerelease.length === 0 && right.prerelease.length === 0) {
    return 0;
  }

  if (left.prerelease.length === 0) {
    return 1;
  }

  if (right.prerelease.length === 0) {
    return -1;
  }

  const maxLength = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];

    if (leftIdentifier === undefined) {
      return -1;
    }

    if (rightIdentifier === undefined) {
      return 1;
    }

    const difference = comparePrereleaseIdentifiers(leftIdentifier, rightIdentifier);
    if (difference !== 0) {
      return difference;
    }
  }

  return 0;
};

const collectWorkspacePackageJsonPaths = async () => {
  const scopedPackageRoots = ['apps', 'packages', 'tools'];
  const scopedPaths = await Promise.all(
    scopedPackageRoots.map(async (rootName) => {
      const rootPath = path.join(ROOT_DIRECTORY, rootName);
      const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);
      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootPath, entry.name, 'package.json'))
        .filter((packageJsonPath) => existsSync(packageJsonPath));
    }),
  );

  return [
    ...scopedPaths.flat(),
    path.join(ROOT_DIRECTORY, 'website', 'package.json'),
  ];
};

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const writeJson = async ({ filePath, json }) => {
  await writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, 'utf8');
};

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
  const targetVersion = uniqueVersions
    .slice()
    .sort(compareVersions)
    .at(-1);

  if (!targetVersion) {
    throw new Error('Cannot sync versions because no workspace package versions were found.');
  }

  const rootPackageJson = await readJson(ROOT_PACKAGE_JSON_PATH);
  const filesToUpdate = workspacePackages.filter((pkg) => pkg.version !== targetVersion);

  for (const pkg of filesToUpdate) {
    const packageJson = await readJson(pkg.filePath);
    await writeJson({
      filePath: pkg.filePath,
      json: {
        ...packageJson,
        version: targetVersion,
      },
    });
  }

  if (rootPackageJson.version !== targetVersion) {
    await writeJson({
      filePath: ROOT_PACKAGE_JSON_PATH,
      json: {
        ...rootPackageJson,
        version: targetVersion,
      },
    });
  }

  const updatedPaths = [
    ...(rootPackageJson.version !== targetVersion ? [path.relative(ROOT_DIRECTORY, ROOT_PACKAGE_JSON_PATH)] : []),
    ...filesToUpdate.map((pkg) => path.relative(ROOT_DIRECTORY, pkg.filePath)),
  ];

  if (updatedPaths.length === 0) {
    process.stdout.write(`Workspace versions already synced at ${targetVersion}.\n`);
    return;
  }

  process.stdout.write(
    `Synced ${updatedPaths.length} workspace package.json files to ${targetVersion}.\n${updatedPaths.join('\n')}\n`,
  );
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
