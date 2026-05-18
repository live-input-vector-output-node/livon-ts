import path from 'node:path';
import { readdir } from 'node:fs/promises';
import * as tar from 'tar';
import { ensureDirectory, parseCsv, pathExists } from './cli-utils.mjs';

const collectBuildOutputDirs = async (rootDirs) => {
  const outputDirs = [];

  const walk = async (dirPath) => {
    const entries = await readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) {
          return;
        }
        const entryPath = path.join(dirPath, entry.name);
        if (entry.name === 'dist' || entry.name === 'build') {
          outputDirs.push(entryPath);
          return;
        }
        await walk(entryPath);
      }),
    );
  };

  await Promise.all(
    rootDirs.map(async (rootDir) => {
      if (await pathExists(rootDir)) {
        await walk(rootDir);
      }
    }),
  );

  return outputDirs;
};

export const createArchive = async ({ archiveFile, cwd, pathsCsv }) => {
  const archivePaths = parseCsv(pathsCsv);
  const ensureIfMissing = new Set(['.pnpm-store', '.turbo']);

  await Promise.all(
    archivePaths
      .filter((entry) => ensureIfMissing.has(entry))
      .map((entry) => ensureDirectory(entry)),
  );

  const existingPaths = (
    await Promise.all(
      archivePaths.map(async (entry) => ({
        entry,
        exists: await pathExists(path.join(cwd, entry)),
      })),
    )
  )
    .filter((entry) => entry.exists)
    .map((entry) => entry.entry);

  if (existingPaths.length === 0) {
    throw new Error(`No paths to archive from: ${archivePaths.join(', ')}`);
  }

  await tar.create(
    {
      cwd,
      file: archiveFile,
      gzip: true,
      portable: true,
    },
    existingPaths,
  );
};

export const extractArchive = async ({ archiveFile, cwd }) => {
  await tar.extract({
    cwd,
    file: archiveFile,
  });
};

export const createBuildOutputsArchive = async ({ archiveFile, cwd, rootsCsv }) => {
  const roots = parseCsv(rootsCsv);
  const buildDirs = await collectBuildOutputDirs(roots);
  await ensureDirectory('.turbo');

  const archiveEntries = ['.turbo', ...buildDirs];
  const existingEntries = (
    await Promise.all(
      archiveEntries.map(async (entry) => ({
        entry,
        exists: await pathExists(path.join(cwd, entry)),
      })),
    )
  )
    .filter((entry) => entry.exists)
    .map((entry) => entry.entry);

  if (existingEntries.length === 0) {
    throw new Error('No build outputs found to archive');
  }

  await tar.create(
    {
      cwd,
      file: archiveFile,
      gzip: true,
      portable: true,
    },
    existingEntries,
  );
};
