import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const findWorkspaceInDirectChildren = (baseDir: string): string | null => {
  try {
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const candidate = path.join(baseDir, entry.name);
      if (existsSync(path.join(candidate, 'pnpm-workspace.yaml'))) {
        return candidate;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const resolveWorkspaceBaseDir = (startDir: string = process.cwd()): string => {
  const resolvedStartDir = path.resolve(startDir);
  let currentDir = resolvedStartDir;

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

  const fallbackWorkspace = findWorkspaceInDirectChildren(resolvedStartDir);
  return fallbackWorkspace ?? resolvedStartDir;
};
