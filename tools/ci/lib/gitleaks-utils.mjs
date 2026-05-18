import { existsSync } from 'node:fs';
import { chmod, rename, writeFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import * as tar from 'tar';
import { ensureDirectory, runCommand } from './cli-utils.mjs';
import { downloadVerifiedAsset } from './download-utils.mjs';

const resolveGitleaksAsset = () => {
  const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
  };

  const archMap = {
    x64: 'x64',
    arm64: 'arm64',
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!platform || !arch) {
    throw new Error(`Unsupported platform/arch for gitleaks: ${process.platform}/${process.arch}`);
  }

  return { arch, platform };
};

const isSafeArchiveEntry = (entryPath) => {
  const normalized = path.posix.normalize(entryPath.replaceAll('\\', '/'));
  if (normalized.startsWith('/')) {
    return false;
  }
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    return false;
  }
  return normalized === 'gitleaks';
};

export const installGitleaks = async ({ version, outputPath }) => {
  const { arch, platform } = resolveGitleaksAsset();
  const archiveName = `gitleaks_${version}_${platform}_${arch}.tar.gz`;
  const releaseBase = `https://github.com/gitleaks/gitleaks/releases/download/v${version}`;
  const archiveUrl = `${releaseBase}/${archiveName}`;
  const checksumUrl = `${releaseBase}/gitleaks_${version}_checksums.txt`;

  const outputDirectory = path.dirname(outputPath);
  const downloadDirectory = path.join('.ci', 'downloads');
  const archivePath = path.join(downloadDirectory, archiveName);

  await ensureDirectory(outputDirectory);
  await ensureDirectory(downloadDirectory);

  const archiveBuffer = await downloadVerifiedAsset({
    assetName: archiveName,
    assetUrl: archiveUrl,
    checksumUrl,
  });
  await writeFile(archivePath, archiveBuffer);

  await tar.extract({
    cwd: outputDirectory,
    file: archivePath,
    filter: (entryPath) => isSafeArchiveEntry(entryPath),
  });

  const extractedBinaryPath = path.join(outputDirectory, 'gitleaks');
  if (outputPath !== extractedBinaryPath) {
    await rename(extractedBinaryPath, outputPath);
  }

  await chmod(outputPath, 0o755);
};

export const runGitleaks = async ({ binaryPath }) => {
  const scanArgs = ['git', '--log-opts=--all', '--redact', '--no-banner', '--exit-code', '1', '.'];

  if (!existsSync(binaryPath)) {
    await installGitleaks({
      version: '8.30.1',
      outputPath: binaryPath,
    });
  }

  await runCommand({
    command: binaryPath,
    args: scanArgs,
  });
};
