import path from 'node:path';
import { REQUIRED_AI_CONTROL_FILES } from '../shared/constants.ts';
import { exists } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

export const runAiControlFilesCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const checks = await Promise.all(
    REQUIRED_AI_CONTROL_FILES.map(async (relativePath) => {
      const absolutePath = path.join(context.baseDir, relativePath);
      return (await exists(absolutePath)) ? null : `${relativePath}: required AI control file is missing`;
    }),
  );

  return {
    id: 'ai-control-files',
    errors: checks.filter((entry): entry is string => entry !== null),
    info: [`required=${REQUIRED_AI_CONTROL_FILES.length}`],
  };
};
