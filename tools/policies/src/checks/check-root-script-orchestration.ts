import { readJson } from '../shared/fs-utils.ts';
import type { PackageJsonLike, PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const ROOT_TURBO_SCRIPT_PATTERN = /^turbo\s+run\s+[a-z0-9:_-]+/i;
const ROOT_FILTER_FLAG_PATTERN = /(?:^|\s)--filter(?:=|\s|$)/i;

export const runRootScriptOrchestrationCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const rootPackageJson = await readJson<PackageJsonLike>(context.rootPackageJsonPath).catch(() => null);
  if (!rootPackageJson) {
    return {
      id: 'root-script-orchestration',
      errors: ['package.json: unable to read root scripts for turbo orchestration checks'],
    };
  }

  const scripts = rootPackageJson.scripts ?? {};
  const scriptEntries = Object.entries(scripts);
  const errors = scriptEntries.flatMap(([name, command]) => {
    if (typeof command !== 'string') {
      return [`package.json: script "${name}" must be a string`];
    }
    if (!ROOT_TURBO_SCRIPT_PATTERN.test(command)) {
      return [`package.json: root script "${name}" must be orchestrated via "turbo run ..."`];
    }
    if (ROOT_FILTER_FLAG_PATTERN.test(command)) {
      return [
        `package.json: root script "${name}" must not hardcode "--filter"; filters are caller-supplied`,
      ];
    }
    return [];
  });

  return {
    id: 'root-script-orchestration',
    errors,
    info: [`scripts=${scriptEntries.length}`],
  };
};
