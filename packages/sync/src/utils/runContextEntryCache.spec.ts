import { describe, expect, it, vi } from 'vitest';

import { createRunContextEntryCache } from './runContextEntryCache.js';

describe('runContextEntryCache', () => {
  it('should reuse primitive cache entries when created value is falsy', () => {
    const createEntry = vi.fn(() => 0);
    const cache = createRunContextEntryCache<string, number>({
      createEntry,
      limit: 4,
    });

    expect(cache.getOrCreate('zero')).toBe(0);
    expect(cache.getOrCreate('zero')).toBe(0);
    expect(createEntry).toHaveBeenCalledTimes(1);
  });

  it('should treat undefined primitive entries as cache hits after first creation', () => {
    const createEntry = vi.fn(() => undefined);
    const cache = createRunContextEntryCache<string, undefined>({
      createEntry,
      limit: 4,
    });

    expect(cache.getOrCreate('unset')).toBeUndefined();
    expect(cache.getOrCreate('unset')).toBeUndefined();
    expect(createEntry).toHaveBeenCalledTimes(1);
  });
});
