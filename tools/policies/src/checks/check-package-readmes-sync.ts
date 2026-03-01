import { createReadmeSyncReport } from '../../../readmes/src/lib.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

export const runPackageReadmesSyncCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const report = await createReadmeSyncReport(context.baseDir, { write: false });

  const mismatchErrors = report.mismatches.map(
    (mismatch) => `${mismatch.target}: ${mismatch.reason}`,
  );

  return {
    id: 'package-readmes-sync',
    errors: [...report.errors, ...mismatchErrors],
    info: [
      `mismatches=${report.mismatches.length}`,
    ],
  };
};
