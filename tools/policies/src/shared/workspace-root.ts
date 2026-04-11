import { existsSync } from 'node:fs';
import path from 'node:path';

export const resolveWorkspaceBaseDir = (startDir: string = process.cwd()): string => {
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

  const fallback = path.join(path.resolve(startDir), 'livon');
  return existsSync(fallback) ? fallback : path.resolve(startDir);
};
