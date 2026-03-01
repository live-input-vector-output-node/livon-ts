import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { FORBIDDEN_MANUAL_VALIDATION_HELPER_PATTERNS, SOURCE_DIR } from '../../shared/constants.ts';
import { collectSourceFiles, exists } from '../../shared/fs-utils.ts';

export const checkForbiddenManualValidationHelpers = async (
  projectPath: string,
  baseDir: string,
): Promise<string[]> => {
  const sourceRoot = path.join(projectPath, SOURCE_DIR);
  if (!(await exists(sourceRoot))) {
    return [];
  }

  const sourceFiles = await collectSourceFiles(sourceRoot);
  const violations = await Promise.all(
    sourceFiles.map(async (filePath) => {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenHelper = FORBIDDEN_MANUAL_VALIDATION_HELPER_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(source);
      });

      if (!hasForbiddenHelper) {
        return [];
      }

      return [
        `${path.relative(baseDir, filePath)}: manual parseX/toX helper declaration is forbidden. Use schema composition and schema.parse.`,
      ];
    }),
  );

  return violations.flat();
};
