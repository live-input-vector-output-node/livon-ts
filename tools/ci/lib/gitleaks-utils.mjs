import { createHash } from 'node:crypto';
import { chmod, writeFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import * as tar from 'tar';
import { ensureDirectory, runCommand } from './cli-utils.mjs';

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

const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

const fetchBinary = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
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

  const checksumsContent = await fetchText(checksumUrl);
  const expectedLine = checksumsContent
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.endsWith(` ${archiveName}`));

  if (!expectedLine) {
    throw new Error(`Checksum for ${archiveName} not found in ${checksumUrl}`);
  }

  const expectedHash = expectedLine.split(' ')[0];
  const archiveBuffer = await fetchBinary(archiveUrl);
  const actualHash = createHash('sha256').update(archiveBuffer).digest('hex');

  if (expectedHash !== actualHash) {
    throw new Error(`Checksum mismatch for ${archiveName}`);
  }

  await writeFile(archivePath, archiveBuffer);

  await tar.extract({
    cwd: outputDirectory,
    file: archivePath,
  });

  await chmod(outputPath, 0o755);
};

export const runGitleaks = async ({ binaryPath }) => {
  const scanArgs = ['git', '--log-opts=--all', '--redact', '--no-banner', '--exit-code', '1', '.'];

  const tryCommands = [
    { command: 'pnpm', args: ['dlx', '@gitleaks/gitleaks', ...scanArgs] },
    { command: 'pnpm', args: ['dlx', 'gitleaks', ...scanArgs] },
    { command: 'npx', args: ['--yes', '@gitleaks/gitleaks', ...scanArgs] },
    { command: 'npx', args: ['--yes', 'gitleaks', ...scanArgs] },
  ];

  for (const entry of tryCommands) {
    try {
      await runCommand(entry);
      return;
    } catch {
      // Continue to the next fallback candidate.
    }
  }

  await runCommand({
    command: binaryPath,
    args: scanArgs,
  });
};
