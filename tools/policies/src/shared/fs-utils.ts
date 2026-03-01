import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { SKIPPED_DIR_NAMES, SOURCE_EXTENSIONS } from './constants.ts';

export const exists = async (targetPath: string): Promise<boolean> =>
  stat(targetPath)
    .then(() => true)
    .catch(() => false);

export const readJson = async <T>(targetPath: string): Promise<T> => {
  const raw = await readFile(targetPath, 'utf8');
  return JSON.parse(raw) as T;
};

const shouldSkipDir = (name: string): boolean => SKIPPED_DIR_NAMES.includes(name as (typeof SKIPPED_DIR_NAMES)[number]);

export const collectFiles = async (dirPath: string): Promise<string[]> => {
  if (!(await exists(dirPath))) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          return [];
        }
        return collectFiles(absolutePath);
      }
      if (!entry.isFile()) {
        return [];
      }
      return [absolutePath];
    }),
  );

  return nested.flat();
};

export const collectProjects = async (rootDir: string): Promise<string[]> => {
  if (!(await exists(rootDir))) {
    return [];
  }

  const entries = await readdir(rootDir, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => path.join(rootDir, entry.name));
  const checks = await Promise.all(
    directories.map(async (directoryPath) =>
      (await exists(path.join(directoryPath, 'package.json'))) ? directoryPath : null,
    ),
  );

  return checks.filter((value): value is string => value !== null);
};

const isSourceFile = (filePath: string): boolean =>
  SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension));

export const collectSourceFiles = async (dirPath: string): Promise<string[]> => {
  if (!(await exists(dirPath))) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          return [];
        }
        return collectSourceFiles(absolutePath);
      }
      if (!entry.isFile() || !isSourceFile(absolutePath)) {
        return [];
      }
      return [absolutePath];
    }),
  );

  return nested.flat();
};
