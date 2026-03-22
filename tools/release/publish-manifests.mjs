import { existsSync } from 'node:fs';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const dependencyFieldNames = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const workspaceRoots = ['apps', 'packages', 'tools'];

export const resolveWorkspaceRoot = (startDir = process.cwd()) => {
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

export const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

export const writeJson = async (filePath, value) => {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
};

const collectWorkspacePackageJsonPaths = async ({ rootDirectory }) => {
  const scopedPackagePaths = await Promise.all(
    workspaceRoots.map(async (rootName) => {
      const rootPath = path.join(rootDirectory, rootName);
      const entries = await readdir(rootPath, { withFileTypes: true }).catch(() => []);

      return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(rootPath, entry.name, 'package.json'));
    }),
  );

  return [
    ...scopedPackagePaths.flat(),
    path.join(rootDirectory, 'website', 'package.json'),
  ];
};

export const loadWorkspacePackageVersions = async ({ rootDirectory }) => {
  const packageJsonPaths = await collectWorkspacePackageJsonPaths({ rootDirectory });
  const packages = await Promise.all(
    packageJsonPaths.map(async (packageJsonPath) => {
      const packageJson = await readJson(packageJsonPath).catch(() => null);
      return packageJson?.name && packageJson?.version
        ? [packageJson.name, packageJson.version]
        : null;
    }),
  );

  return new Map(packages.filter((entry) => entry !== null));
};

export const collectPublishablePackages = async ({ rootDirectory }) => {
  const packagesDirectory = path.join(rootDirectory, 'packages');
  const entries = await readdir(packagesDirectory, { withFileTypes: true });

  const packages = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const directory = path.join(packagesDirectory, entry.name);
        const packageJsonPath = path.join(directory, 'package.json');
        const packageJson = await readJson(packageJsonPath).catch(() => null);

        if (!packageJson || packageJson.private === true) {
          return null;
        }

        return {
          directory,
          packageJson,
          packageJsonPath,
          relativeDirectory: path.relative(rootDirectory, directory),
        };
      }),
  );

  return packages.filter((entry) => entry !== null);
};

const resolveWorkspaceRange = ({ name, range, workspaceVersions }) => {
  if (!range.startsWith('workspace:')) {
    return range;
  }

  const version = workspaceVersions.get(name);
  if (!version) {
    return range;
  }

  const workspaceRange = range.slice('workspace:'.length);

  if (workspaceRange === '' || workspaceRange === '*') {
    return version;
  }

  if (workspaceRange === '^' || workspaceRange === '^*') {
    return `^${version}`;
  }

  if (workspaceRange === '~' || workspaceRange === '~*') {
    return `~${version}`;
  }

  return workspaceRange;
};

const sanitizeDependencyRecord = ({ dependencies, workspaceVersions }) => {
  if (!dependencies || typeof dependencies !== 'object') {
    return undefined;
  }

  const nextDependencies = Object.entries(dependencies).reduce((acc, [name, range]) => {
    return {
      ...acc,
      [name]: typeof range === 'string'
        ? resolveWorkspaceRange({ name, range, workspaceVersions })
        : range,
    };
  }, {});

  return Object.keys(nextDependencies).length > 0 ? nextDependencies : undefined;
};

const sanitizeExports = (value) => {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeExports(entry));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  const nextValue = Object.entries(value).reduce((acc, [key, nestedValue]) => {
    if (key === 'development') {
      return acc;
    }

    return {
      ...acc,
      [key]: sanitizeExports(nestedValue),
    };
  }, {});

  return Object.keys(nextValue).length > 0 ? nextValue : undefined;
};

export const sanitizePackageJson = ({ packageJson, workspaceVersions }) => {
  const nextPackageJson = {
    ...packageJson,
    exports: sanitizeExports(packageJson.exports),
  };

  delete nextPackageJson.devDependencies;
  delete nextPackageJson.scripts;

  dependencyFieldNames.forEach((fieldName) => {
    const sanitizedDependencies = sanitizeDependencyRecord({
      dependencies: packageJson[fieldName],
      workspaceVersions,
    });

    if (sanitizedDependencies) {
      nextPackageJson[fieldName] = sanitizedDependencies;
      return;
    }

    delete nextPackageJson[fieldName];
  });

  if (!nextPackageJson.exports) {
    delete nextPackageJson.exports;
  }

  return nextPackageJson;
};

export const applySanitizedPackageJsons = async ({ packages, workspaceVersions }) => {
  const backups = [];

  for (const pkg of packages) {
    const originalContent = await readFile(pkg.packageJsonPath, 'utf8');
    const packageJson = JSON.parse(originalContent);
    const sanitizedPackageJson = sanitizePackageJson({
      packageJson,
      workspaceVersions,
    });

    backups.push({
      originalContent,
      packageJsonPath: pkg.packageJsonPath,
    });

    await writeJson(pkg.packageJsonPath, sanitizedPackageJson);
  }

  return backups;
};

export const restorePackageJsons = async ({ backups }) => {
  for (const backup of backups) {
    await writeFile(backup.packageJsonPath, backup.originalContent, 'utf8');
  }
};
