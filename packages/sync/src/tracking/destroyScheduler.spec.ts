import { afterEach, describe, expect, it, vi } from 'vitest';

describe('destroyScheduler', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('should not throw on import when the timer API is unavailable', async () => {
    vi.stubGlobal('setTimeout', undefined);
    vi.stubGlobal('clearTimeout', undefined);

    const module = await import('./destroyScheduler.js');

    expect(module.clearPendingTrackedUnitDestroy).toBeTypeOf('function');
    expect(module.scheduleTrackedUnitDestroy).toBeTypeOf('function');
  });

  it('should throw only when scheduling a delayed destroy without timer support', async () => {
    vi.stubGlobal('setTimeout', undefined);
    vi.stubGlobal('clearTimeout', undefined);

    const { scheduleTrackedUnitDestroy } = await import('./destroyScheduler.js');

    expect(() => {
      scheduleTrackedUnitDestroy({
        unit: {},
        destroyDelay: 10,
        onDestroy: vi.fn(),
      });
    }).toThrow('Timer API is not available on globalThis.');
  });

  it('should destroy immediately without timer support when delay is zero', async () => {
    vi.stubGlobal('setTimeout', undefined);
    vi.stubGlobal('clearTimeout', undefined);

    const { scheduleTrackedUnitDestroy } = await import('./destroyScheduler.js');
    const onDestroy = vi.fn();

    scheduleTrackedUnitDestroy({
      unit: {},
      destroyDelay: 0,
      onDestroy,
    });

    expect(onDestroy).toHaveBeenCalledTimes(1);
  });
});
