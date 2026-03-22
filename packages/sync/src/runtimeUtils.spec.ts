import { describe, expect, it } from 'vitest';

import { stableSerialize } from './utils/index.js';
import { randomString } from './testing/randomData.js';

interface SerializableObject {
  a: number;
  b: number;
}

describe('runtimeUtils', () => {
  describe('stableSerialize()', () => {
    it('should serialize null as literal null string when input is null', () => {
      const serialized = stableSerialize(null);

      expect(serialized).toBe('null');
    });

    it('should serialize arrays recursively when input is an array', () => {
      const objectValue: SerializableObject = {
        a: 1,
        b: 2,
      };

      const serialized = stableSerialize([1, 'x', objectValue]);

      expect(serialized).toBe('[1,"x",{"a":1,"b":2}]');
    });

    it('should serialize non-record values through fallback string conversion', () => {
      const symbolValue = Symbol(randomString({ prefix: 'symbol' }));

      const serialized = stableSerialize(symbolValue);

      expect(serialized).toBe(JSON.stringify(String(symbolValue)));
    });
  });
});
