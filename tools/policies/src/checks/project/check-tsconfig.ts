import path from 'node:path';
import { exists, readJson } from '../../shared/fs-utils.ts';

const isStringArray = (value: unknown): value is readonly string[] => {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
};

export const checkTsconfig = async (projectPath: string): Promise<string[]> => {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (!(await exists(tsconfigPath))) {
    return [];
  }

  const tsconfig = await readJson<{ extends?: unknown }>(tsconfigPath).catch(() => null);
  if (!tsconfig || typeof tsconfig.extends === 'undefined') {
    return [`${projectPath}: tsconfig.json missing extends`];
  }

  const extendsValues =
    typeof tsconfig.extends === 'string'
      ? [tsconfig.extends]
      : isStringArray(tsconfig.extends)
        ? [...tsconfig.extends]
        : [];

  if (extendsValues.length === 0) {
    return [`${projectPath}: tsconfig.json extends must be a string or string[]`];
  }

  const invalidExtends = extendsValues.filter(
    (value) => !value.startsWith('@livon/typescript/'),
  );

  if (invalidExtends.length > 0) {
    return [
      `${projectPath}: tsconfig.json must only extend @livon/typescript/* presets`,
    ];
  }

  return [];
};
