import { describe, expect, it } from 'vitest';

import { serializeKey } from './utils/index.js';
import { randomString } from './testing/randomData.js';

interface SerializableObject {
  a: number;
  b: number;
}

describe('runtimeUtils', () => {
  describe('serializeKey()', () => {
    it('should produce stable key for null input', () => {
      const serialized = serializeKey(null);

      expect(serialized.length).toBeGreaterThan(0);
      expect(serializeKey(null)).toBe(serialized);
    });

    it('should produce deterministic key for same array input and distinct key for reordered array input', () => {
      const objectValue: SerializableObject = {
        a: 1,
        b: 2,
      };

      const serialized = serializeKey([1, 'x', objectValue]);
      const reordered = serializeKey(['x', 1, { b: 2, a: 1 }]);

      expect(serialized).not.toBe(reordered);
      expect(serializeKey([1, 'x', objectValue])).toBe(serialized);
    });

    it('should throw when key input is not msgpack-serializable', () => {
      const symbolValue = Symbol(randomString({ prefix: 'symbol' }));

      expect(() => serializeKey(symbolValue)).toThrowError(
        'Cannot serialize key input with msgpackr. Scope and payload must be msgpack-serializable.',
      );
    });
  });
});
