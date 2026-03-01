import path from 'node:path';
import {
  LOWER_KEBAB_MARKDOWN_NAME_PATTERN,
  MARKDOWN_FILE_EXTENSION,
  MARKDOWN_NAME_EXCEPTIONS,
} from '../shared/constants.ts';
import { collectFiles } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

export const runAiMarkdownNamingCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const targetDirectories = [
    path.join(context.baseDir, 'website', 'docs', 'ai'),
    path.join(context.baseDir, '.github', 'instructions'),
  ];

  const violations = await Promise.all(
    targetDirectories.map(async (directoryPath) => {
      const files = await collectFiles(directoryPath);
      return files
        .filter((filePath) => filePath.endsWith(MARKDOWN_FILE_EXTENSION))
        .filter((filePath) => !MARKDOWN_NAME_EXCEPTIONS.has(path.basename(filePath)))
        .filter((filePath) => !LOWER_KEBAB_MARKDOWN_NAME_PATTERN.test(path.basename(filePath)))
        .map((filePath) => `${path.relative(context.baseDir, filePath)}: markdown filename must use lowercase-kebab-case`);
    }),
  );

  return {
    id: 'ai-markdown-naming',
    errors: violations.flat(),
  };
};
