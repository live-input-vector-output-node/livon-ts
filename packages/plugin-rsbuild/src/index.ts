import type { RsbuildPlugin } from '@rsbuild/core';
import {
  resolveLivonGeneratedClientPath,
  startLivonClientSyncWatcher,
  syncLivonClient,
  type LivonClientSyncWatcher,
} from '@livon/client-sync';
import type { LivonClientSyncPluginConfig } from '@livon/contract';

interface CreateAliasInput {
  config: LivonClientSyncPluginConfig;
  rootPath: string;
}

interface RunSyncInput {
  config: LivonClientSyncPluginConfig;
  rootPath: string;
  mode: 'dev' | 'build';
}

const createAlias = ({ config, rootPath }: CreateAliasInput): Record<string, string> => ({
  [config.importIdentifier ?? '@livon/generated']: resolveLivonGeneratedClientPath({ config, projectRoot: rootPath }),
});

const runSync = async ({ config, rootPath, mode }: RunSyncInput): Promise<void> => {
  const syncMode = config.syncMode ?? 'startup';
  if (syncMode === 'manual') {
    return;
  }
  if (syncMode === 'build' && mode !== 'build') {
    return;
  }
  await syncLivonClient({ config: { ...config, projectRoot: rootPath }, logger: console });
};

export const livonClientSyncPlugin = (config: LivonClientSyncPluginConfig): RsbuildPlugin => {
  let watcher: LivonClientSyncWatcher | undefined;
  return {
    name: 'livon-client-sync',
    setup: (api) => {
      api.modifyRsbuildConfig((rsbuildConfig) => ({
        ...rsbuildConfig,
        resolve: {
          ...rsbuildConfig.resolve,
          alias: {
            ...rsbuildConfig.resolve?.alias,
            ...createAlias({ config, rootPath: api.context.rootPath }),
          },
        },
      }));
      api.onBeforeBuild(async () => {
        await runSync({ config, rootPath: api.context.rootPath, mode: 'build' });
      });
      api.onBeforeDevCompile(async () => {
        await runSync({ config, rootPath: api.context.rootPath, mode: 'dev' });
        if (config.syncMode === 'watch' && !watcher) {
          watcher = startLivonClientSyncWatcher({
            config: { ...config, projectRoot: api.context.rootPath },
            logger: console,
          });
        }
      });
      api.onCloseDevServer(() => {
        watcher?.stop();
        watcher = undefined;
      });
    },
  };
};
