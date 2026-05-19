import { describe, expect, it } from 'vitest';

import { livonClientSyncPlugin } from './index.js';

describe('livonClientSyncPlugin()', () => {
  it('creates an rsbuild plugin', () => {
    const plugin = livonClientSyncPlugin({ url: 'ws://localhost/ws' });

    expect(plugin.name).toBe('livon-client-sync');
  });
});
