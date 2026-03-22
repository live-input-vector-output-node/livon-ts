import { afterEach, describe, expect, it, vi } from 'vitest';

import { cloneValue } from './cloneValue.js';

interface ClonableShape {
  createdAt: Date;
  total: bigint;
  tags: Set<string>;
  lookup: Map<string, number>;
  matcher: RegExp;
  optional: undefined;
  nested: {
    value: number;
  };
}

describe('cloneValue()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('happy', () => {
    it('should preserve structured values when falling back without structuredClone', () => {
      const value: ClonableShape = {
        createdAt: new Date('2026-03-22T12:34:56.000Z'),
        total: 99n,
        tags: new Set(['sync', 'cache']),
        lookup: new Map([
          ['one', 1],
          ['two', 2],
        ]),
        matcher: /draft/gi,
        optional: undefined,
        nested: {
          value: Number.NaN,
        },
      };

      vi.stubGlobal('structuredClone', undefined);

      const cloned = cloneValue(value);

      expect(cloned).not.toBe(value);
      expect(cloned.createdAt).toBeInstanceOf(Date);
      expect(cloned.createdAt.toISOString()).toBe('2026-03-22T12:34:56.000Z');
      expect(cloned.total).toBe(99n);
      expect(cloned.tags).toBeInstanceOf(Set);
      expect(Array.from(cloned.tags.values())).toEqual(['sync', 'cache']);
      expect(cloned.lookup).toBeInstanceOf(Map);
      expect(Array.from(cloned.lookup.entries())).toEqual([
        ['one', 1],
        ['two', 2],
      ]);
      expect(cloned.matcher).toBeInstanceOf(RegExp);
      expect(cloned.matcher.source).toBe('draft');
      expect(cloned.matcher.flags).toBe('gi');
      expect(cloned.optional).toBeUndefined();
      expect(Number.isNaN(cloned.nested.value)).toBe(true);
      expect(cloned.nested).not.toBe(value.nested);
    });
  });
});
