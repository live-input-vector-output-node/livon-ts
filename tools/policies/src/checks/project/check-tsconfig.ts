import path from 'node:path';
import { exists, readJson } from '../../shared/fs-utils.ts';

export const checkTsconfig = async (projectPath: string): Promise<string[]> => {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (!(await exists(tsconfigPath))) {
    return [];
  }

  const tsconfig = await readJson<{ extends?: unknown }>(tsconfigPath).catch(() => null);
  if (!tsconfig || typeof tsconfig.extends !== 'string') {
    return [`${projectPath}: tsconfig.json missing extends`];
  }

  if (!tsconfig.extends.startsWith('@livon/config/tsconfig/')) {
    return [`${projectPath}: tsconfig.json must extend @livon/config/tsconfig/*`];
  }

  return [];
};
