import { createPolicyContext } from './src/shared/context.ts';
import { runBadgeContractCheck } from './src/checks/check-badge-contract.ts';

const run = async (): Promise<void> => {
  const context = createPolicyContext();
  const result = await runBadgeContractCheck(context);

  const status = result.errors.length > 0 ? 'FAILED' : 'OK';
  console.log(`[${status}] ${result.id}`);

  if (result.info && result.info.length > 0) {
    result.info.forEach((entry) => {
      console.log(`  info: ${entry}`);
    });
  }

  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      console.log(`  error: ${error}`);
    });
    process.exit(1);
  }

  console.log('Badge contract check passed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
