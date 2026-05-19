import { createUnplugin } from 'unplugin';
import {
  resolveLivonGeneratedClientPath,
  startLivonClientSyncWatcher,
  syncLivonClient,
  type LivonClientSyncWatcher,
} from '@livon/client-sync';
import type { LivonClientSyncPluginConfig } from '@livon/contract';

interface RunPluginSyncInput {
  config: LivonClientSyncPluginConfig;
  root: string;
  command: 'serve' | 'build';
}

interface ResolveAliasInput {
  config: LivonClientSyncPluginConfig;
  root: string;
  id: string;
}

const runPluginSync = async ({ config, root, command }: RunPluginSyncInput): Promise<void> => {
  const syncMode = config.syncMode ?? 'startup';
  if (syncMode === 'manual') {
    return;
  }
  if (syncMode === 'build' && command !== 'build') {
    return;
  }
  await syncLivonClient({ config: { ...config, projectRoot: root }, logger: console });
};

const resolveAlias = ({ config, root, id }: ResolveAliasInput): string | undefined => {
  const importIdentifier = config.importIdentifier ?? '@livon/generated';
  return id === importIdentifier
    ? resolveLivonGeneratedClientPath({ config, projectRoot: root })
    : undefined;
};

export const livonClientSyncUnplugin = createUnplugin<LivonClientSyncPluginConfig>((config) => {
  let root = process.cwd();
  let command: 'serve' | 'build' = 'build';
  let watcher: LivonClientSyncWatcher | undefined;

  return {
    name: 'livon-client-sync',
    enforce: 'pre',
    configResolved: (resolvedConfig: { root: string; command: 'serve' | 'build' }) => {
      root = resolvedConfig.root;
      command = resolvedConfig.command;
    },
    buildStart: async () => {
      await runPluginSync({ config, root, command });
      if (command === 'serve' && config.syncMode === 'watch' && !watcher) {
        watcher = startLivonClientSyncWatcher({ config: { ...config, projectRoot: root }, logger: console });
      }
    },
    buildEnd: () => {
      watcher?.stop();
      watcher = undefined;
    },
    resolveId: (id) => resolveAlias({ config, root, id }),
  };
});
