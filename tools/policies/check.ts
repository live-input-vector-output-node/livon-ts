import { createPolicyContext } from './src/shared/context.ts';
import type { PolicyCheckResult } from './src/shared/types.ts';
import { runAiControlFilesCheck } from './src/checks/check-ai-control-files.ts';
import { runAiMarkdownNamingCheck } from './src/checks/check-ai-markdown-naming.ts';
import { runAiRoutingConfigCheck } from './src/checks/check-ai-routing-config.ts';
import { runLinksCheck } from './src/checks/check-links.ts';
import { runLintWarningBudgetCheck } from './src/checks/check-lint-warning-budget.ts';
import { runPackageReadmesSyncCheck } from './src/checks/check-package-readmes-sync.ts';
import { runRootGateCheck } from './src/checks/check-root-gate.ts';
import { runRootScriptOrchestrationCheck } from './src/checks/check-root-script-orchestration.ts';
import { runSpecializationsCheck } from './src/checks/check-specializations.ts';
import { runProjectPoliciesCheck } from './src/checks/run-project-policies.ts';
import { runVersionParityCheck } from './src/checks/check-version-parity.ts';

const printResult = (result: PolicyCheckResult): void => {
  const status = result.errors.length > 0 ? 'FAILED' : 'OK';
  console.log(`[${status}] ${result.id}`);

  if (result.info && result.info.length > 0) {
    result.info.forEach((entry) => {
      console.log(`  info: ${entry}`);
    });
  }

  if (result.warnings && result.warnings.length > 0) {
    result.warnings.forEach((warning) => {
      console.log(`  warning: ${warning}`);
    });
  }

  if (result.errors.length > 0) {
    result.errors.forEach((error) => {
      console.log(`  error: ${error}`);
    });
  }
};

const run = async (): Promise<void> => {
  const context = createPolicyContext();

  const checks = [
    runProjectPoliciesCheck,
    runRootScriptOrchestrationCheck,
    runVersionParityCheck,
    runAiControlFilesCheck,
    runPackageReadmesSyncCheck,
    runRootGateCheck,
    runSpecializationsCheck,
    runAiMarkdownNamingCheck,
    runAiRoutingConfigCheck,
    runLintWarningBudgetCheck,
    runLinksCheck,
  ];

  const results: PolicyCheckResult[] = await Promise.all(
    checks.map(async (checkFn) => {
      try {
        return await checkFn(context);
      } catch (error) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        return {
          id: checkFn.name || 'unnamed-check',
          errors: [message],
        };
      }
    }),
  );

  console.log(`Policy checks executed: ${results.length}`);
  results.forEach((result) => {
    printResult(result);
  });

  const totalErrors = results.reduce((sum, result) => sum + result.errors.length, 0);
  if (totalErrors > 0) {
    console.error(`Policy check failed with ${totalErrors} error(s).`);
    process.exit(1);
  }

  console.log('Policy check passed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
