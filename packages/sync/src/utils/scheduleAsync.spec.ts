import { describe, expect, it, vi } from 'vitest';

import { scheduleAsync, type SchedulerRuntime } from './scheduleAsync.js';

describe('scheduleAsync()', () => {
  describe('happy', () => {
    it('should use queueMicrotask when runtime provides microtask scheduler', () => {
      const callback = vi.fn();
      const queueMicrotask = vi.fn((nextCallback: () => void) => {
        nextCallback();
      });
      const setTimeout = vi.fn();
      const runtime: SchedulerRuntime = {
        queueMicrotask,
        setTimeout,
      };

      scheduleAsync({
        callback,
        runtime,
      });

      expect(queueMicrotask).toHaveBeenCalledTimes(1);
      expect(setTimeout).not.toHaveBeenCalled();
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should fallback to setTimeout when runtime has no queueMicrotask', () => {
      const callback = vi.fn();
      const setTimeoutSpy = vi.fn((nextCallback: () => void) => {
        nextCallback();
        return null;
      });
      const runtime: SchedulerRuntime = {
        setTimeout: setTimeoutSpy,
      };

      scheduleAsync({
        callback,
        runtime,
      });

      expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe('sad', () => {
    it('should throw when runtime provides neither queueMicrotask nor setTimeout', () => {
      const callback = vi.fn();
      const runtime: SchedulerRuntime = {};

      expect(() => {
        scheduleAsync({
          callback,
          runtime,
        });
      }).toThrow('No async scheduler is available on runtime.');
    });
  });
});
