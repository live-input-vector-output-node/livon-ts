import { gzipSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const targets = [
  {
    badgeId: 'runtime',
    label: 'runtime size',
    mode: 'dist-esm',
    directory: 'packages/runtime',
  },
  {
    badgeId: 'schema',
    label: 'schema size',
    mode: 'dist-esm',
    directory: 'packages/schema',
  },
  {
    badgeId: 'client',
    label: 'client size',
    mode: 'dist-esm',
    directory: 'packages/client',
  },
  {
    badgeId: 'client-ws-transport',
    label: 'client-ws size',
    mode: 'dist-esm',
    directory: 'packages/client-ws-transport',
  },
  {
    badgeId: 'node-ws-transport',
    label: 'node-ws size',
    mode: 'dist-esm',
    directory: 'packages/server-ws-transport',
  },
  {
    badgeId: 'dlq-module',
    label: 'dlq size',
    mode: 'dist-esm',
    directory: 'packages/dlq-module',
  },
  {
    badgeId: 'cli',
    label: 'cli size',
    mode: 'dist-esm',
    directory: 'packages/cli',
  },
  {
    badgeId: 'config',
    label: 'config size',
    mode: 'package-files',
    directory: 'packages/config',
  },
];

const [outputDirectoryArg] = process.argv.slice(2);
const rootDirectory = process.cwd();
const outputDirectory = resolve(outputDirectoryArg ?? '.github/badges');

const formatBytes = (value) => {
  if (value < 1024) {
    return `${value} B`;
  }

  return `${(value / 1024).toFixed(1)} kB`;
};

const colorFromGzipBytes = (bytes) =>
  bytes <= 3 * 1024 ? 'brightgreen' :
    bytes <= 8 * 1024 ? 'green' :
      bytes <= 16 * 1024 ? 'yellowgreen' :
        bytes <= 28 * 1024 ? 'yellow' :
          bytes <= 48 * 1024 ? 'orange' :
            'red';

const listFilesRecursively = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });

const collectDistEsmFiles = (packageDirectory) => {
  const distDirectory = join(packageDirectory, 'dist');
  const files = listFilesRecursively(distDirectory)
    .filter((filePath) => filePath.endsWith('.js') || filePath.endsWith('.mjs'))
    .filter((filePath) => !filePath.endsWith('.cjs'))
    .filter((filePath) => !filePath.endsWith('.spec.js'))
    .filter((filePath) => !filePath.endsWith('.test.js'))
    .sort((left, right) => left.localeCompare(right));

  if (files.length === 0) {
    throw new Error(`No ESM dist files found in ${distDirectory}`);
  }

  return files;
};

const collectPackageFiles = (packageDirectory) => {
  const packageJsonPath = join(packageDirectory, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const filesField = Array.isArray(packageJson.files) ? packageJson.files : [];

  const files = filesField.flatMap((entry) => {
    const entryPath = join(packageDirectory, entry);
    const stats = statSync(entryPath);
    return stats.isDirectory() ? listFilesRecursively(entryPath) : [entryPath];
  });

  if (files.length === 0) {
    throw new Error(`No package files configured for ${packageDirectory}`);
  }

  return files.sort((left, right) => left.localeCompare(right));
};

const createBadge = ({ label, totalBytes, gzipBytes }) => {
  return {
    schemaVersion: 1,
    label,
    message: `${formatBytes(totalBytes)} / ${formatBytes(gzipBytes)} gz`,
    color: colorFromGzipBytes(gzipBytes),
  };
};

const calculateSizeData = (filePaths) => {
  const buffers = filePaths.map((filePath) => readFileSync(filePath));
  const totalBytes = filePaths.reduce((sum, filePath) => sum + statSync(filePath).size, 0);
  const combinedBuffer = Buffer.concat(
    buffers.flatMap((buffer, index) => (index === 0 ? [buffer] : [Buffer.from('\n'), buffer])),
  );
  const gzipBytes = gzipSync(combinedBuffer, { level: 9 }).length;

  return {
    totalBytes,
    gzipBytes,
  };
};

mkdirSync(outputDirectory, { recursive: true });

targets.forEach((target) => {
  const packageDirectory = join(rootDirectory, target.directory);
  const filePaths =
    target.mode === 'dist-esm'
      ? collectDistEsmFiles(packageDirectory)
      : collectPackageFiles(packageDirectory);
  const { totalBytes, gzipBytes } = calculateSizeData(filePaths);
  const badge = createBadge({
    label: target.label,
    totalBytes,
    gzipBytes,
  });
  const outputPath = join(outputDirectory, `size-${target.badgeId}.json`);

  writeFileSync(outputPath, `${JSON.stringify(badge, null, 2)}\n`);
  // eslint-disable-next-line no-console
  console.log(`${target.badgeId}: ${badge.message} -> ${outputPath}`);
});
