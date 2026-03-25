import { describe, expect, it } from 'vitest';

import {
  resolveAdaptiveReadWriteByCache,
  resolveAdaptiveReadWriteConfig,
  resolveAdaptiveReadWriteDefault,
  resolveAdaptiveReadWriteProfileKey,
} from './adaptiveReadWrite.js';

describe('adaptive read write matrix', () => {
  describe('happy', () => {
    it('should resolve profile key from cache and lru flags', () => {
      expect(resolveAdaptiveReadWriteProfileKey({
        cacheEnabled: false,
        lruEnabled: false,
      })).toBe('cache-off-lru-off');
      expect(resolveAdaptiveReadWriteProfileKey({
        cacheEnabled: false,
        lruEnabled: true,
      })).toBe('cache-off-lru-on');
      expect(resolveAdaptiveReadWriteProfileKey({
        cacheEnabled: true,
        lruEnabled: false,
      })).toBe('cache-on-lru-off');
      expect(resolveAdaptiveReadWriteProfileKey({
        cacheEnabled: true,
        lruEnabled: true,
      })).toBe('cache-on-lru-on');
    });

    it('should resolve operation strategy for explicit profile', () => {
      const fallback = resolveAdaptiveReadWriteDefault();
      const resolved = resolveAdaptiveReadWriteConfig({
        profile: 'cache-on-lru-on',
        operation: 'setMany',
        fallback,
      });

      expect(typeof resolved.batch).toBe('boolean');
      expect(typeof resolved.subview).toBe('boolean');
    });

    it('should resolve operation strategy by cache flags', () => {
      const fallback = resolveAdaptiveReadWriteDefault();
      const resolved = resolveAdaptiveReadWriteByCache({
        cacheEnabled: true,
        lruEnabled: true,
        operation: 'updateMany',
        fallback,
      });

      expect(typeof resolved.batch).toBe('boolean');
      expect(typeof resolved.subview).toBe('boolean');
    });
  });
});
