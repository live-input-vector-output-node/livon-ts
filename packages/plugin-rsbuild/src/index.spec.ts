import { describe, expect, it } from 'vitest';

import { livonClientSyncPlugin } from './index.js';

interface TestRsbuildConfig {
  resolve?: {
    alias?: Record<string, string>;
  };
}

interface TestRsbuildApi {
  context: {
    rootPath: string;
  };
  modifyRsbuildConfig: (callback: (config: TestRsbuildConfig) => TestRsbuildConfig) => void;
  onBeforeBuild: (callback: () => Promise<void>) => void;
  onBeforeDevCompile: (callback: () => Promise<void>) => void;
  onCloseDevServer: (callback: () => void) => void;
}

describe('livonClientSyncPlugin()', () => {
  it('creates an rsbuild plugin', () => {
    const plugin = livonClientSyncPlugin({ url: 'ws://localhost/ws' });

    expect(plugin.name).toBe('livon-client-sync');
  });

  it('registers aliases and lifecycle hooks without syncing in manual mode', async () => {
    const buildCallbacks: Array<() => Promise<void>> = [];
    const devCallbacks: Array<() => Promise<void>> = [];
    const closeCallbacks: Array<() => void> = [];
    let modifiedConfig: TestRsbuildConfig | undefined;
    const plugin = livonClientSyncPlugin({
      url: 'ws://localhost/ws',
      syncMode: 'manual',
      outputDirectory: '.cache/livon',
      importIdentifier: '@demo/generated',
    });
    const api: TestRsbuildApi = {
      context: { rootPath: '/repo' },
      modifyRsbuildConfig: (callback) => {
        modifiedConfig = callback({ resolve: { alias: { react: 'react' } } });
      },
      onBeforeBuild: (callback) => {
        buildCallbacks.push(callback);
      },
      onBeforeDevCompile: (callback) => {
        devCallbacks.push(callback);
      },
      onCloseDevServer: (callback) => {
        closeCallbacks.push(callback);
      },
    };

    plugin.setup?.(api as Parameters<NonNullable<typeof plugin.setup>>[0]);
    await Promise.all(buildCallbacks.map((callback) => callback()));
    await Promise.all(devCallbacks.map((callback) => callback()));
    closeCallbacks.forEach((callback) => callback());

    expect(modifiedConfig?.resolve?.alias).toMatchObject({
      react: 'react',
      '@demo/generated': '/repo/.cache/livon/client.ts',
    });
    expect(buildCallbacks).toHaveLength(1);
    expect(devCallbacks).toHaveLength(1);
    expect(closeCallbacks).toHaveLength(1);
  });

  it('skips build-only sync during dev compile', async () => {
    const devCallbacks: Array<() => Promise<void>> = [];
    const plugin = livonClientSyncPlugin({
      url: 'ws://localhost/ws',
      syncMode: 'build',
    });
    const api: TestRsbuildApi = {
      context: { rootPath: '/repo' },
      modifyRsbuildConfig: () => undefined,
      onBeforeBuild: () => undefined,
      onBeforeDevCompile: (callback) => {
        devCallbacks.push(callback);
      },
      onCloseDevServer: () => undefined,
    };

    plugin.setup?.(api as Parameters<NonNullable<typeof plugin.setup>>[0]);
    await Promise.all(devCallbacks.map((callback) => callback()));

    expect(devCallbacks).toHaveLength(1);
  });
});
