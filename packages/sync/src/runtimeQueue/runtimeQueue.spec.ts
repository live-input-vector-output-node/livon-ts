import { describe, expect, it, vi } from 'vitest';

import { createRuntimeQueue } from './createRuntimeQueue.js';

interface QueueCallback {
  (): void;
}

interface QueueCallbacks extends Array<QueueCallback> {}

describe('createRuntimeQueue()', () => {
  describe('happy', () => {
    it('should run fire and forget tasks asynchronously by default', async () => {
      const queue = createRuntimeQueue();
      const run = vi.fn();

      queue.enqueue({
        channel: 'state',
        run,
      });

      expect(run).toHaveBeenCalledTimes(0);
      await Promise.resolve();
      expect(run).toHaveBeenCalledTimes(1);
    });

    it('should run sync tasks immediately', () => {
      const queue = createRuntimeQueue();
      const run = vi.fn();

      queue.enqueue({
        channel: 'state',
        mode: 'sync',
        run,
      });

      expect(run).toHaveBeenCalledTimes(1);
    });

    it('should keep only the latest task for the same key before flush', () => {
      const scheduledCallbacks: QueueCallbacks = [];
      const queue = createRuntimeQueue({
        schedule: (callback) => {
          scheduledCallbacks.push(callback);
        },
      });
      const firstRun = vi.fn();
      const secondRun = vi.fn();

      queue.enqueue({
        channel: 'state',
        key: 'same-key',
        run: firstRun,
      });
      queue.enqueue({
        channel: 'state',
        key: 'same-key',
        run: secondRun,
      });
      scheduledCallbacks[0]?.();

      expect(firstRun).toHaveBeenCalledTimes(0);
      expect(secondRun).toHaveBeenCalledTimes(1);
    });

    it('should flush only the requested channel', () => {
      const queue = createRuntimeQueue({
        schedule: () => undefined,
      });
      const stateRun = vi.fn();
      const storageRun = vi.fn();

      queue.enqueue({
        channel: 'state',
        run: stateRun,
      });
      queue.enqueue({
        channel: 'storage',
        run: storageRun,
      });
      queue.flush('state');

      expect(stateRun).toHaveBeenCalledTimes(1);
      expect(storageRun).toHaveBeenCalledTimes(0);
    });

    it('should schedule another batch when one batch is exhausted', () => {
      const scheduledCallbacks: QueueCallbacks = [];
      const queue = createRuntimeQueue({
        batchSizes: {
          state: 1,
        },
        schedule: (callback) => {
          scheduledCallbacks.push(callback);
        },
      });
      const firstRun = vi.fn();
      const secondRun = vi.fn();

      queue.enqueue({
        channel: 'state',
        key: 'first',
        run: firstRun,
      });
      queue.enqueue({
        channel: 'state',
        key: 'second',
        run: secondRun,
      });
      scheduledCallbacks[0]?.();
      scheduledCallbacks[1]?.();

      expect(firstRun).toHaveBeenCalledTimes(1);
      expect(secondRun).toHaveBeenCalledTimes(1);
    });
  });
});
