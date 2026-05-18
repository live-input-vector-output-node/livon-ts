import path from 'node:path';
import { readdir } from 'node:fs/promises';
import * as tar from 'tar';
import { ensureDirectory, parseCsv, pathExists } from './cli-utils.mjs';

const BLOCKED_WALK_DIR_NAMES = new Set(['.git', '.turbo', 'node_modules']);
const SAFE_ARCHIVE_ROOTS = new Set(['.turbo', 'apps', 'packages', 'tools', 'website']);

const isSafeArchiveEntry = (entryPath) => {
  const normalized = path.posix.normalize(entryPath.replaceAll('\\', '/'));
  if (normalized.startsWith('/')) {
    return false;
  }
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    return false;
  }

  const rootSegment = normalized.split('/')[0];
  return SAFE_ARCHIVE_ROOTS.has(rootSegment);
};

const collectBuildOutputDirs = async ({ cwd, rootDirs }) => {
  const outputDirs = [];

  const walk = async ({ dirPath, relativePath }) => {
    const entries = await readdir(dirPath, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (!entry.isDirectory()) {
          return;
        }
        if (BLOCKED_WALK_DIR_NAMES.has(entry.name)) {
          return;
        }

        const entryPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        if (entry.name === 'dist' || entry.name === 'build') {
          outputDirs.push(entryRelativePath);
          return;
        }
        await walk({
          dirPath: entryPath,
          relativePath: entryRelativePath,
        });
      }),
    );
  };

  await Promise.all(
    rootDirs.map(async (rootDir) => {
      const rootPath = path.join(cwd, rootDir);
      if (await pathExists(rootPath)) {
        await walk({
          dirPath: rootPath,
          relativePath: rootDir,
        });
      }
    }),
  );

  return outputDirs;
};

export const extractArchive = async ({ archiveFile, cwd }) => {
  await tar.extract({
    cwd,
    file: archiveFile,
    filter: (entryPath) => isSafeArchiveEntry(entryPath),
  });
};

export const createBuildOutputsArchive = async ({ archiveFile, cwd, rootsCsv }) => {
  const roots = parseCsv(rootsCsv);
  const buildDirs = await collectBuildOutputDirs({
    cwd,
    rootDirs: roots,
  });
  await ensureDirectory(path.join(cwd, '.turbo'));

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
