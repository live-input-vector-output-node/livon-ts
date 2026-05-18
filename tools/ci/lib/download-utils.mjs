import { createHash } from 'node:crypto';

export const fetchText = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return response.text();
};

export const fetchBinary = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
};

export const downloadVerifiedAsset = async ({ assetName, assetUrl, checksumUrl }) => {
  const checksumsContent = await fetchText(checksumUrl);
  const expectedLine = checksumsContent
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.endsWith(` ${assetName}`));

  if (!expectedLine) {
    throw new Error(`Checksum for ${assetName} not found in ${checksumUrl}`);
  }

  const expectedHash = expectedLine.split(/\s+/)[0];
  const assetBuffer = await fetchBinary(assetUrl);
  const actualHash = createHash('sha256').update(assetBuffer).digest('hex');

  if (expectedHash !== actualHash) {
    throw new Error(`Checksum mismatch for ${assetName}`);
  }

  return assetBuffer;
};
