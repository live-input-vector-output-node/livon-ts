import { describe, expect, it } from 'vitest';

import { createSerializedKeyCache } from './serializedKeyCache.js';

describe('createSerializedKeyCache()', () => {
  it('should reuse object keys for the same object reference', () => {
    let readCount = 0;
    const input = {
      get value() {
        readCount += 1;
        return 'cached';
      },
    };

    const cache = createSerializedKeyCache();
    const first = cache.getOrCreateKey(input);
    const second = cache.getOrCreateKey(input);

    expect(first).toBe(second);
    expect(readCount).toBe(1);
  });

  it('should keep primitive key cache bounded by limit', () => {
    const cache = createSerializedKeyCache({
      limit: 1,
    });

    const first = cache.getOrCreateKey('first');
    cache.getOrCreateKey('second');
    const firstAfterEviction = cache.getOrCreateKey('first');

    expect(firstAfterEviction).toBe(first);
  });

  it('should skip object cache in payload-hot-path mode', () => {
    let readCount = 0;
    const input = {
      get value() {
        readCount += 1;
        return 'payload';
      },
    };

    const cache = createSerializedKeyCache({
      mode: 'payload-hot-path',
    });
    cache.getOrCreateKey(input);
    cache.getOrCreateKey(input);

    expect(readCount).toBe(2);
  });

  it('should skip object and primitive cache in dependency mode', () => {
    let readCount = 0;
    const input = {
      get value() {
        readCount += 1;
        return 'dependency';
      },
    };

    const cache = createSerializedKeyCache({
      mode: 'dependency',
    });
    cache.getOrCreateKey(input);
    cache.getOrCreateKey(input);

    expect(readCount).toBe(2);
  });

  it('should allow mode override with explicit cache flags', () => {
    let readCount = 0;
    const input = {
      get value() {
        readCount += 1;
        return 'override';
      },
    };

    const cache = createSerializedKeyCache({
      mode: 'dependency',
      cacheObjects: true,
    });
    cache.getOrCreateKey(input);
    cache.getOrCreateKey(input);

    expect(readCount).toBe(1);
  });
});
