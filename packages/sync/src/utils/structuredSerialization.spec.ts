import { describe, expect, it } from 'vitest';

import {
  deserializeStructuredValue,
  serializeStructuredValue,
  stableSerializeStructuredValue,
} from './structuredSerialization.js';

interface MarkerCollisionValue {
  __livonSerializedValue__: number;
  __livonType__: string;
  nested: {
    value: number;
  };
}

interface StructuredValueShape {
  createdAt: Date;
  invalidDate: Date;
  total: bigint;
  emptyValue: undefined;
  notANumber: number;
  positiveInfinity: number;
  negativeInfinity: number;
  negativeZero: number;
  matcher: RegExp;
  tags: Set<string>;
  lookup: Map<string, number>;
  nested: {
    values: readonly [undefined, Date];
  };
}

describe('structuredSerialization', () => {
  describe('happy', () => {
    it('should round-trip supported structured values without losing their types', () => {
      const value: StructuredValueShape = {
        createdAt: new Date('2026-03-22T12:34:56.000Z'),
        invalidDate: new Date(Number.NaN),
        total: 12345678901234567890n,
        emptyValue: undefined,
        notANumber: Number.NaN,
        positiveInfinity: Number.POSITIVE_INFINITY,
        negativeInfinity: Number.NEGATIVE_INFINITY,
        negativeZero: -0,
        matcher: /livon/gi,
        tags: new Set(['sync', 'react']),
        lookup: new Map([
          ['alpha', 1],
          ['beta', 2],
        ]),
        nested: {
          values: [undefined, new Date('2026-03-22T00:00:00.000Z')],
        },
      };

      const serialized = serializeStructuredValue({
        input: value,
      });
      const deserialized = deserializeStructuredValue<StructuredValueShape>(serialized);

      expect(deserialized.createdAt).toBeInstanceOf(Date);
      expect(deserialized.createdAt.toISOString()).toBe('2026-03-22T12:34:56.000Z');
      expect(deserialized.invalidDate).toBeInstanceOf(Date);
      expect(Number.isNaN(deserialized.invalidDate.getTime())).toBe(true);
      expect(deserialized.total).toBe(12345678901234567890n);
      expect(deserialized.emptyValue).toBeUndefined();
      expect(Number.isNaN(deserialized.notANumber)).toBe(true);
      expect(deserialized.positiveInfinity).toBe(Number.POSITIVE_INFINITY);
      expect(deserialized.negativeInfinity).toBe(Number.NEGATIVE_INFINITY);
      expect(Object.is(deserialized.negativeZero, -0)).toBe(true);
      expect(deserialized.matcher).toBeInstanceOf(RegExp);
      expect(deserialized.matcher.source).toBe('livon');
      expect(deserialized.matcher.flags).toBe('gi');
      expect(deserialized.tags).toBeInstanceOf(Set);
      expect(Array.from(deserialized.tags.values())).toEqual(['sync', 'react']);
      expect(deserialized.lookup).toBeInstanceOf(Map);
      expect(Array.from(deserialized.lookup.entries())).toEqual([
        ['alpha', 1],
        ['beta', 2],
      ]);
      expect(deserialized.nested.values[0]).toBeUndefined();
      expect(deserialized.nested.values[1]).toBeInstanceOf(Date);
      expect(deserialized.nested.values[1].toISOString()).toBe('2026-03-22T00:00:00.000Z');
    });

    it('should preserve plain objects that collide with serializer marker keys', () => {
      const value: MarkerCollisionValue = {
        __livonSerializedValue__: 1,
        __livonType__: 'plain-object',
        nested: {
          value: 42,
        },
      };

      const serialized = serializeStructuredValue({
        input: value,
      });
      const deserialized = deserializeStructuredValue<MarkerCollisionValue>(serialized);

      expect(deserialized).toEqual(value);
    });

    it('should create stable keys for special values and order-insensitive collections', () => {
      const firstMap = new Map([
        ['beta', 2],
        ['alpha', 1],
      ]);
      const secondMap = new Map([
        ['alpha', 1],
        ['beta', 2],
      ]);
      const firstSet = new Set(['react', 'sync']);
      const secondSet = new Set(['sync', 'react']);

      const firstMapKey = stableSerializeStructuredValue(firstMap);
      const secondMapKey = stableSerializeStructuredValue(secondMap);
      const firstSetKey = stableSerializeStructuredValue(firstSet);
      const secondSetKey = stableSerializeStructuredValue(secondSet);

      expect(firstMapKey).toBe(secondMapKey);
      expect(firstSetKey).toBe(secondSetKey);
      expect(stableSerializeStructuredValue({ value: Number.NaN })).not.toBe(
        stableSerializeStructuredValue({ value: null }),
      );
      expect(stableSerializeStructuredValue(12n)).not.toBe(
        stableSerializeStructuredValue('12'),
      );
    });
  });

  describe('sad', () => {
    it('should throw when round-trip serialization receives function values', () => {
      expect(() => {
        serializeStructuredValue({
          input: {
            handler: () => undefined,
          },
        });
      }).toThrow('Cannot serialize function values in @livon/sync.');
    });
  });
});
