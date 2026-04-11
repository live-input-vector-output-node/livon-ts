import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { exists } from '../../shared/fs-utils.ts';

export const checkEslint = async (projectPath: string): Promise<string[]> => {
  const tsPath = path.join(projectPath, 'eslint.config.ts');
  const mjsPath = path.join(projectPath, 'eslint.config.mjs');
  const cjsPath = path.join(projectPath, 'eslint.config.cjs');
  const jsPath = path.join(projectPath, 'eslint.config.js');

  if (!(await exists(tsPath))) {
    if ((await exists(mjsPath)) || (await exists(cjsPath)) || (await exists(jsPath))) {
      return [`${projectPath}: eslint config must be eslint.config.ts`];
    }
    return [];
  }

  const source = await readFile(tsPath, 'utf8').catch(() => null);
  if (source === null) {
    return [`${projectPath}: unable to read eslint.config.ts`];
  }

  if (!source.includes('@livon/eslint')) {
    return [`${projectPath}: eslint config must import @livon/eslint presets`];
  }

  return [];
};
