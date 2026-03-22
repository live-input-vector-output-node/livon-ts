import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { mkdtemp, readdir, rm } from 'node:fs/promises';

import {
  applySanitizedPackageJsons,
  collectPublishablePackages,
  loadWorkspacePackageVersions,
  resolveWorkspaceRoot,
  restorePackageJsons,
  sanitizePackageJson,
} from './publish-manifests.mjs';

const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const dependencyFieldNames = ['dependencies', 'optionalDependencies', 'peerDependencies'];
const disallowedPackedPathPatterns = [
  /\/AGENTS\.md$/,
  /\/PROMPTS?\.md$/,
  /\/__mocks__\//,
  /\/mocks\//,
  /\/src\//,
  /\/testing\//,
  /\/tests?\//,
  /\.spec\./,
  /\.test\./,
];

const runCommand = ({ args, command, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stderr, stdout });
        return;
      }

      reject(new Error(`${command} ${args.join(' ')} failed\n${stderr || stdout}`));
    });

    child.on('error', (error) => {
      reject(error);
    });
  });

const collectExportPaths = (value) => {
  if (typeof value === 'string') {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectExportPaths(entry));
  }

  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value).flatMap((entry) => collectExportPaths(entry));
};

const validatePackedEntries = ({ entries, pkg }) => {
  const errors = [];
  const nonManifestEntries = entries.filter((entry) => entry !== 'package/package.json');
  const exportPaths = collectExportPaths(pkg.packageJson.exports);
  const expectsDist = [
    pkg.packageJson.main,
    pkg.packageJson.module,
    pkg.packageJson.types,
    ...exportPaths,
  ].some((entry) => typeof entry === 'string' && entry.startsWith('./dist/'));

  if (nonManifestEntries.length === 0) {
    errors.push(`${pkg.relativeDirectory}: packed tarball contains only package.json`);
  }

  if (!entries.includes('package/README.md')) {
    errors.push(`${pkg.relativeDirectory}: packed tarball is missing README.md`);
  }

  if (!entries.includes('package/LICENSE.md')) {
    errors.push(`${pkg.relativeDirectory}: packed tarball is missing LICENSE.md`);
  }

  if (!entries.includes('package/THIRD_PARTY_NOTICES.md')) {
    errors.push(`${pkg.relativeDirectory}: packed tarball is missing THIRD_PARTY_NOTICES.md`);
  }

  if (expectsDist && !entries.some((entry) => entry.startsWith('package/dist/'))) {
    errors.push(`${pkg.relativeDirectory}: packed tarball is missing dist artifacts`);
  }

  disallowedPackedPathPatterns.forEach((pattern) => {
    const match = entries.find((entry) => pattern.test(entry));
    if (match) {
      errors.push(`${pkg.relativeDirectory}: packed tarball contains disallowed file ${match}`);
    }
  });

  if (entries.includes('package/LICENCE.md')) {
    errors.push(`${pkg.relativeDirectory}: packed tarball still contains legacy LICENCE.md`);
  }

  return errors;
};

const validateSanitizedManifest = ({ pkg, workspaceVersions }) => {
  const errors = [];
  const sanitizedPackageJson = sanitizePackageJson({
    packageJson: pkg.packageJson,
    workspaceVersions,
  });

  if ('devDependencies' in sanitizedPackageJson) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest still contains devDependencies`);
  }

  if ('scripts' in sanitizedPackageJson) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest still contains scripts`);
  }

  if (typeof sanitizedPackageJson.license !== 'string' || sanitizedPackageJson.license.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing license`);
  }

  if (typeof sanitizedPackageJson.description !== 'string' || sanitizedPackageJson.description.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing description`);
  }

  if (typeof sanitizedPackageJson.homepage !== 'string' || sanitizedPackageJson.homepage.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing homepage`);
  }

  if (!Array.isArray(sanitizedPackageJson.keywords) || sanitizedPackageJson.keywords.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing keywords`);
  }

  if (typeof sanitizedPackageJson.repository?.url !== 'string' || sanitizedPackageJson.repository.url.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing repository.url`);
  }

  if (
    typeof sanitizedPackageJson.repository?.directory !== 'string'
    || sanitizedPackageJson.repository.directory.length === 0
  ) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing repository.directory`);
  }

  if (typeof sanitizedPackageJson.bugs?.url !== 'string' || sanitizedPackageJson.bugs.url.length === 0) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest is missing bugs.url`);
  }

  if (JSON.stringify(sanitizedPackageJson.exports ?? {}).includes('"development"')) {
    errors.push(`${pkg.relativeDirectory}: sanitized manifest still exposes development exports`);
  }

  dependencyFieldNames.forEach((fieldName) => {
    Object.entries(sanitizedPackageJson[fieldName] ?? {}).forEach(([name, range]) => {
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        errors.push(`${pkg.relativeDirectory}: sanitized manifest still contains workspace range for ${fieldName}.${name}`);
      }

      if (range === 'latest') {
        errors.push(`${pkg.relativeDirectory}: sanitized manifest still contains non-deterministic range for ${fieldName}.${name}`);
      }
    });
  });

  return errors;
};

const packPackage = async ({ pkg, rootDirectory }) => {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), 'livon-release-check-'));

  try {
    await runCommand({
      args: ['-C', pkg.directory, 'pack', '--pack-destination', tempDirectory],
      command: PNPM_BIN,
      cwd: rootDirectory,
    });

    const packedFiles = await readdir(tempDirectory);
    const tarballName = packedFiles.find((fileName) => fileName.endsWith('.tgz'));

    if (!tarballName) {
      throw new Error(`${pkg.relativeDirectory}: pnpm pack did not produce a tarball`);
    }

    const tarballPath = path.join(tempDirectory, tarballName);
    const { stdout } = await runCommand({
      args: ['-tzf', tarballPath],
      command: 'tar',
      cwd: rootDirectory,
    });

    return stdout.split('\n').filter((entry) => entry.length > 0).sort((left, right) => left.localeCompare(right));
  } finally {
    await rm(tempDirectory, { force: true, recursive: true });
  }
};

const run = async () => {
  const rootDirectory = resolveWorkspaceRoot();
  const packages = await collectPublishablePackages({ rootDirectory });
  const workspaceVersions = await loadWorkspacePackageVersions({ rootDirectory });
  const errors = [];
  let backups = [];

  try {
    backups = await applySanitizedPackageJsons({ packages, workspaceVersions });

    for (const pkg of packages) {
      const entries = await packPackage({ pkg, rootDirectory });
      errors.push(...validatePackedEntries({ entries, pkg }));
      errors.push(...validateSanitizedManifest({ pkg, workspaceVersions }));
    }
  } finally {
    await restorePackageJsons({ backups });
  }

  if (errors.length > 0) {
    errors.forEach((error) => {
      process.stderr.write(`${error}\n`);
    });
    process.exit(1);
  }

  process.stdout.write(`Release artifact check passed for ${packages.length} publishable packages.\n`);
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
