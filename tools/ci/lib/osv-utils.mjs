import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { chmod, writeFile } from 'node:fs/promises';
import process from 'node:process';
import path from 'node:path';
import { ensureDirectory } from './cli-utils.mjs';

const resolveAssetName = ({ version }) => {
  const platformMap = {
    darwin: 'darwin',
    linux: 'linux',
    win32: 'windows',
  };

  const archMap = {
    x64: 'amd64',
    arm64: 'arm64',
  };

  const platform = platformMap[process.platform];
  const arch = archMap[process.arch];

  if (!platform || !arch) {
    throw new Error(`Unsupported platform/arch for osv-scanner: ${process.platform}/${process.arch}`);
  }

  const extension = platform === 'windows' ? '.exe' : '';

  return `osv-scanner_${platform}_${arch}${extension}`;
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

export const installOsvScanner = async ({ version, outputPath }) => {
  const assetName = resolveAssetName({ version });
  const releaseBase = `https://github.com/google/osv-scanner/releases/download/v${version}`;
  const assetUrl = `${releaseBase}/${assetName}`;
  const checksumUrl = `${releaseBase}/osv-scanner_SHA256SUMS`;

  const outputDirectory = path.dirname(outputPath);
  await ensureDirectory(outputDirectory);

  const checksumsContent = await fetchText(checksumUrl);
  const expectedLine = checksumsContent
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.endsWith(` ${assetName}`));

  if (!expectedLine) {
    throw new Error(`Checksum for ${assetName} not found in ${checksumUrl}`);
  }

  const expectedHash = expectedLine.split(/\s+/)[0];
  const binary = await fetchBinary(assetUrl);
  const actualHash = createHash('sha256').update(binary).digest('hex');

  if (expectedHash !== actualHash) {
    throw new Error(`Checksum mismatch for ${assetName}`);
  }

  await writeFile(outputPath, binary);
  if (process.platform !== 'win32') {
    await chmod(outputPath, 0o755);
  }
};

export const runOsvScanner = async ({ binaryPath }) => {
  const args = ['scan', 'source', '--recursive', '--licenses=MIT', '.'];

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn(binaryPath, args, {
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode === 0 || exitCode === 1) {
    return;
  }

  throw new Error(`${binaryPath} ${args.join(' ')} failed with exit code ${exitCode ?? -1}`);
};
