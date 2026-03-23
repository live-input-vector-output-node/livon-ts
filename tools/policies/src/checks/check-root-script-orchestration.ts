import path from 'node:path';
import { readJson } from '../shared/fs-utils.ts';
import type { PackageJsonLike, PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const ROOT_TURBO_SCRIPT_PATTERN = /^turbo\s+run\s+[a-z0-9:_-]+/i;
const ROOT_FILTER_FLAG_PATTERN = /(?:^|\s)--filter(?:=|\s|$)/i;

interface TurboConfigLike {
  readonly tasks?: Record<string, unknown>;
}

const extractTurboRunTasks = (command: string): string[] => {
  const withoutPrefix = command.replace(/^turbo\s+run\s+/i, '').trim();
  if (withoutPrefix.length === 0) {
    return [];
  }

  const tokens = withoutPrefix.split(/\s+/);
  const tasks: string[] = [];
  for (const token of tokens) {
    if (token === '--' || token.startsWith('-')) {
      break;
    }
    tasks.push(token);
  }

  return tasks;
};

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

  const turboConfig = await readJson<TurboConfigLike>(path.join(context.baseDir, 'turbo.json')).catch(
    () => null,
  );
  if (!turboConfig || !turboConfig.tasks) {
    return {
      id: 'root-script-orchestration',
      errors: ['turbo.json: unable to read tasks for root script orchestration checks'],
    };
  }
  const knownTurboTasks = new Set(Object.keys(turboConfig.tasks));

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
    const scriptTasks = extractTurboRunTasks(command);
    if (scriptTasks.length === 0) {
      return [`package.json: root script "${name}" must define at least one turbo task`];
    }
    const unknownTasks = scriptTasks.filter((taskName) => !knownTurboTasks.has(taskName));
    if (unknownTasks.length > 0) {
      return [
        `package.json: root script "${name}" references tasks not declared in turbo.json: ${unknownTasks.join(', ')}`,
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
