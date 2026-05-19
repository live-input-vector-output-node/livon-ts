import { describe, expect, it } from 'vitest';

import { livonClientSyncUnplugin } from './core.js';
import { livonClientSyncPlugin as rollupPlugin } from './rollup.js';
import { livonClientSyncPlugin as rspackPlugin } from './rspack.js';
import { livonClientSyncPlugin as vitePlugin } from './vite.js';
import { livonClientSyncPlugin as webpackPlugin } from './webpack.js';

interface TestPlugin {
  name?: string;
  configResolved?: TestConfigResolved;
  buildStart?: TestBuildStart;
  buildEnd?: TestBuildEnd;
  resolveId?: TestResolveId;
}

interface TestResolvedConfig {
  root: string;
  command: 'serve' | 'build';
}

type TestConfigResolved = (config: TestResolvedConfig) => void;

type TestBuildStart = () => Promise<void> | void;

type TestBuildEnd = () => void;

type TestResolveId = (id: string) => string | undefined;

const firstPlugin = (plugin: unknown): TestPlugin =>
  (Array.isArray(plugin) ? plugin[0] : plugin) as TestPlugin;

describe('livonClientSyncUnplugin', () => {
  it('creates a vite plugin adapter', () => {
    const plugin = livonClientSyncUnplugin.vite({ url: 'ws://localhost/ws', syncMode: 'manual' });
    const adapter = firstPlugin(plugin);

    expect(adapter.name).toBe('livon-client-sync');
  });

  it('exports all bundler adapters', () => {
    expect(firstPlugin(vitePlugin({ url: 'ws://localhost/ws', syncMode: 'manual' })).name).toBe('livon-client-sync');
    expect(firstPlugin(rollupPlugin({ url: 'ws://localhost/ws', syncMode: 'manual' })).name).toBe('livon-client-sync');
    expect(firstPlugin(webpackPlugin({ url: 'ws://localhost/ws', syncMode: 'manual' }))).toBeDefined();
    expect(firstPlugin(rspackPlugin({ url: 'ws://localhost/ws', syncMode: 'manual' }))).toBeDefined();
  });

  it('resolves the generated client alias without running manual sync', async () => {
    const plugin = firstPlugin(livonClientSyncUnplugin.vite({
      url: 'ws://localhost/ws',
      syncMode: 'manual',
      outputDirectory: '.cache/livon',
      importIdentifier: '@demo/generated',
    }));

    plugin.configResolved?.({ root: '/repo', command: 'serve' });
    await plugin.buildStart?.();

    expect(plugin.resolveId?.('@demo/generated')).toBe('/repo/.cache/livon/client.ts');
    expect(plugin.resolveId?.('@other/generated')).toBeUndefined();
    plugin.buildEnd?.();
  });

  it('skips build-only sync during dev startup', async () => {
    const plugin = firstPlugin(livonClientSyncUnplugin.vite({
      url: 'ws://localhost/ws',
      syncMode: 'build',
    }));

    plugin.configResolved?.({ root: '/repo', command: 'serve' });
    await plugin.buildStart?.();

    expect(plugin.resolveId?.('@livon/generated')).toBe('/repo/.livon/generated/client.ts');
  });
});
