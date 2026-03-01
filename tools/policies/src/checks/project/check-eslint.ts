import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { exists } from '../../shared/fs-utils.ts';

export const checkEslint = async (projectPath: string): Promise<string[]> => {
  const eslintPath = path.join(projectPath, 'eslint.config.cjs');
  if (!(await exists(eslintPath))) {
    return [];
  }

  const source = await readFile(eslintPath, 'utf8');
  if (!source.includes('@livon/config/eslint/base.cjs')) {
    return [`${projectPath}: eslint.config.cjs must require @livon/config/eslint/base.cjs`];
  }

  return [];
};
