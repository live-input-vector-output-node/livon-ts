import { describe, expect, it } from 'vitest';

import { createIdentityUnitCache } from './createIdentityUnitCache.js';

describe('createIdentityUnitCache()', () => {
  describe('happy', () => {
    it('should evict the least recently used entry when max entries is exceeded', () => {
      const cache = createIdentityUnitCache<number>({
        maxEntries: 2,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      cache.set('c', 3);

      expect(cache.get('a')).toBeUndefined();
      expect(cache.get('b')).toBe(2);
      expect(cache.get('c')).toBe(3);
      expect(cache.size()).toBe(2);
    });

    it('should keep recently read entry when applying lru eviction', () => {
      const cache = createIdentityUnitCache<number>({
        maxEntries: 2,
      });

      cache.set('a', 1);
      cache.set('b', 2);
      expect(cache.get('a')).toBe(1);

      cache.set('c', 3);

      expect(cache.get('a')).toBe(1);
      expect(cache.get('b')).toBeUndefined();
      expect(cache.get('c')).toBe(3);
      expect(cache.size()).toBe(2);
    });
  });
});
