import { createReadmeSyncReport, resolveWorkspaceRoot } from './lib.ts';

const run = async (): Promise<void> => {
  const baseDir = resolveWorkspaceRoot();
  const report = await createReadmeSyncReport(baseDir, { write: false });

  if (report.errors.length > 0) {
    report.errors.forEach((error) => {
      console.error(error);
    });
    process.exit(1);
  }

  if (report.mismatches.length === 0) {
    console.log('Package README sync check passed.');
    return;
  }

  console.error('Package README sync check failed:');
  report.mismatches.forEach((mismatch) => {
    console.error(`- ${mismatch.target}: ${mismatch.reason}`);
  });
  console.error('Run: pnpm turbo run gen:readmes');
  process.exit(1);
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
