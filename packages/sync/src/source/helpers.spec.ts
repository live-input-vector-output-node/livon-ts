import { describe, expect, it } from 'vitest';

import {
  readSourceCacheRecord,
  resolveCacheLruMaxEntries,
} from './helpers.js';

interface Todo {
  id: string;
  title: string;
}

describe('source helpers', () => {
  describe('readSourceCacheRecord()', () => {
    it('should return undefined for invalid entity array entries', () => {
      const invalidCacheRecord = {
        mode: 'many',
        entities: [null],
        writtenAt: Date.now(),
      };

      const record = readSourceCacheRecord<Todo>(invalidCacheRecord);

      expect(record).toBeUndefined();
    });

    it('should return undefined when one-mode cache contains more than one entity', () => {
      const invalidCacheRecord = {
        mode: 'one',
        entities: [
          {
            id: 'todo-1',
            title: 'first',
          },
          {
            id: 'todo-2',
            title: 'second',
          },
        ],
        writtenAt: Date.now(),
      };

      const record = readSourceCacheRecord<Todo>(invalidCacheRecord);

      expect(record).toBeUndefined();
    });
  });

  describe('resolveCacheLruMaxEntries()', () => {
    it('should keep default lru value when cache exists without explicit lru config', () => {
      const resolvedLru = resolveCacheLruMaxEntries({
        sourceCache: {
          ttl: 'infinity',
          key: 'source',
        },
        entityCache: undefined,
      });

      expect(resolvedLru).toBe(256);
    });

    it('should keep default lru value when explicit lru config is invalid', () => {
      const resolvedLru = resolveCacheLruMaxEntries({
        sourceCache: {
          ttl: 'infinity',
          key: 'source',
          lruMaxEntries: Number.NaN,
        },
        entityCache: undefined,
      });

      expect(resolvedLru).toBe(256);
    });

    it('should disable lru only when lru is explicitly set to zero', () => {
      const resolvedLru = resolveCacheLruMaxEntries({
        sourceCache: {
          ttl: 'infinity',
          key: 'source',
          lruMaxEntries: 0,
        },
        entityCache: undefined,
      });

      expect(resolvedLru).toBe(0);
    });
  });
});
