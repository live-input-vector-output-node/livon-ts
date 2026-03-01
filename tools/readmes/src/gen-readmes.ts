import { createReadmeSyncReport, resolveWorkspaceRoot } from './lib.ts';

const run = async (): Promise<void> => {
  const baseDir = resolveWorkspaceRoot();
  const report = await createReadmeSyncReport(baseDir, { write: true });

  if (report.errors.length > 0) {
    report.errors.forEach((error) => {
      console.error(error);
    });
    process.exit(1);
  }

  if (report.updated.length === 0) {
    console.log('Package READMEs are already up to date.');
    return;
  }

  console.log(`Updated package READMEs: ${report.updated.length}`);
  report.updated.forEach((entry) => {
    console.log(`- ${entry}`);
  });
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
