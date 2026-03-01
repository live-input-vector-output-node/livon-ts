import { runLinkCheck } from '../../link-check.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

export const runLinksCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const result = await runLinkCheck({
    baseDir: context.baseDir,
    checkExternal: true,
    verbose: false,
  });

  const warnings = result.externalRestricted.map(
    (entry) => `${entry.url}: status ${entry.statusCode}`,
  );

  const info = [
    `scannedFiles=${result.metrics.scannedFiles}`,
    `refs=${result.metrics.referencesTotal}`,
    `localBroken=${result.metrics.localBroken}`,
    `externalBroken=${result.metrics.externalBroken}`,
    `externalRestricted=${result.metrics.externalRestricted}`,
  ];

  return {
    id: 'links',
    errors: result.errors,
    warnings,
    info,
  };
};
