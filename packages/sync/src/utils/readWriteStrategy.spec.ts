import { describe, expect, it, vi } from 'vitest';

import {
  resolveEntityReadWriteConfig,
  runEntityWriteStrategy,
} from './readWriteStrategy.js';

describe('readWriteStrategy', () => {
  describe('resolveEntityReadWriteConfig()', () => {
    it('should resolve default config when no input is provided', () => {
      expect(resolveEntityReadWriteConfig()).toEqual({
        batch: true,
        subview: true,
      });
    });

    it('should resolve partial input while keeping defaults for missing flags', () => {
      expect(resolveEntityReadWriteConfig({ batch: false })).toEqual({
        batch: false,
        subview: true,
      });
      expect(resolveEntityReadWriteConfig({ subview: false })).toEqual({
        batch: true,
        subview: false,
      });
    });
  });

  describe('runEntityWriteStrategy()', () => {
    it('should run immediate path when batch strategy is disabled', () => {
      const runImmediate = vi.fn();
      const runBatched = vi.fn();

      runEntityWriteStrategy({
        strategy: {
          batch: false,
          subview: true,
        },
        changedIdCount: 200,
        affectedKeyCount: 200,
        hasDuplicates: true,
        batchThreshold: 32,
        runImmediate,
        runBatched,
      });

      expect(runImmediate).toHaveBeenCalledTimes(1);
      expect(runBatched).not.toHaveBeenCalled();
    });

    it('should run batched path when strategy is enabled and threshold is exceeded', () => {
      const runImmediate = vi.fn();
      const runBatched = vi.fn();

      runEntityWriteStrategy({
        strategy: {
          batch: true,
          subview: true,
        },
        changedIdCount: 40,
        affectedKeyCount: 1,
        hasDuplicates: false,
        batchThreshold: 32,
        runImmediate,
        runBatched,
      });

      expect(runBatched).toHaveBeenCalledTimes(1);
      expect(runImmediate).not.toHaveBeenCalled();
    });

    it('should run immediate path when strategy is enabled and changes are small', () => {
      const runImmediate = vi.fn();
      const runBatched = vi.fn();

      runEntityWriteStrategy({
        strategy: {
          batch: true,
          subview: true,
        },
        changedIdCount: 3,
        affectedKeyCount: 1,
        hasDuplicates: false,
        batchThreshold: 32,
        runImmediate,
        runBatched,
      });

      expect(runImmediate).toHaveBeenCalledTimes(1);
      expect(runBatched).not.toHaveBeenCalled();
    });
  });
});
