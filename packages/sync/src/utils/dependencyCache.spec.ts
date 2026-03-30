import { describe, expect, it, vi } from 'vitest';

import { createDependencyCache } from './dependencyCache.js';

describe('createDependencyCache()', () => {
  describe('happy', () => {
    it('should return same instance when primary and secondary dependencies are equal', () => {
      const cache = createDependencyCache<{ value: string }>();
      const build = vi.fn(() => {
        return {
          value: 'entry',
        };
      });

      const first = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      const second = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      expect(first).toBe(second);
      expect(build).toHaveBeenCalledTimes(1);
    });

    it('should return different instances when secondary dependencies differ', () => {
      const cache = createDependencyCache<{ value: string }>();
      const build = vi
        .fn(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-b',
          };
        });

      const first = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      const second = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-b'],
        build,
      });

      expect(first).not.toBe(second);
      expect(build).toHaveBeenCalledTimes(2);
    });

    it('should use default secondary bucket when secondary dependencies are omitted', () => {
      const cache = createDependencyCache<{ value: string }>();
      const build = vi.fn(() => {
        return {
          value: 'entry',
        };
      });

      const first = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        build,
      });
      const second = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        build,
      });

      expect(first).toBe(second);
      expect(build).toHaveBeenCalledTimes(1);
    });

    it('should evict the oldest secondary entry when limit is exceeded', () => {
      const cache = createDependencyCache<{ value: string }>({ limit: 2 });
      const build = vi
        .fn(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-b',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-c',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a-new',
          };
        });

      cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-b'],
        build,
      });
      cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-c'],
        build,
      });

      const payloadAAfterEvict = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      expect(payloadAAfterEvict.value).toBe('entry-a-new');
      expect(build).toHaveBeenCalledTimes(4);
    });

    it('should remove only the targeted primary dependency bucket', () => {
      const cache = createDependencyCache<{ value: string }>();
      const build = vi
        .fn(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-b',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a-new',
          };
        });

      const identityAFirst = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      const identityBFirst = cache.getOrCreate({
        primaryDependencies: ['identity-b'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      cache.clearPrimary({
        primaryDependencies: ['identity-a'],
      });

      const identityASecond = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      const identityBSecond = cache.getOrCreate({
        primaryDependencies: ['identity-b'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      expect(identityAFirst).not.toBe(identityASecond);
      expect(identityBFirst).toBe(identityBSecond);
    });
  });

  describe('sad', () => {
    it('should return false when deleting a non-existing entry', () => {
      const cache = createDependencyCache<{ value: string }>();

      const deleted = cache.delete({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
      });

      expect(deleted).toBe(false);
    });

    it('should clear all entries when clear is called', () => {
      const cache = createDependencyCache<{ value: string }>();
      const build = vi
        .fn(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-a',
          };
        })
        .mockImplementationOnce(() => {
          return {
            value: 'entry-b',
          };
        });

      const first = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      cache.clear();

      const second = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      expect(first).not.toBe(second);
      expect(build).toHaveBeenCalledTimes(2);
    });

    it('should treat cached undefined values as cache hits', () => {
      const cache = createDependencyCache<undefined>();
      const build = vi.fn(() => {
        return undefined;
      });

      const first = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });
      const second = cache.getOrCreate({
        primaryDependencies: ['identity-a'],
        secondaryDependencies: ['payload-a'],
        build,
      });

      expect(first).toBeUndefined();
      expect(second).toBeUndefined();
      expect(build).toHaveBeenCalledTimes(1);
    });
  });
});
