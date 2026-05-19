import { describe, expect, it } from 'vitest';

import { livonClientSyncUnplugin } from './core.js';

describe('livonClientSyncUnplugin', () => {
  it('creates a vite plugin adapter', () => {
    const plugin = livonClientSyncUnplugin.vite({ url: 'ws://localhost/ws', syncMode: 'manual' });
    const firstPlugin = Array.isArray(plugin) ? plugin[0] : plugin;

    expect(firstPlugin?.name).toBe('livon-client-sync');
  });
});
