import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { isArray, isBoolean, isDate, isNumber, isRecord, isString, isUint8Array } from './typeGuards.js';

describe('typeGuards', () => {
  let validDate: Date;
  let invalidDate: Date;
  let bytes: Uint8Array;

  beforeAll(() => {
    validDate = new Date(0);
    invalidDate = new Date('invalid');
    bytes = new Uint8Array([]);
  });

  beforeEach(() => {
    validDate = new Date('2026-01-01T00:00:00.000Z');
    invalidDate = new Date('invalid');
    bytes = new Uint8Array([1, 2, 3]);
  });

  afterEach(() => {
    validDate = new Date(0);
    invalidDate = new Date('invalid');
    bytes = new Uint8Array([]);
  });

  afterAll(() => {
    validDate = new Date(0);
    invalidDate = new Date('invalid');
    bytes = new Uint8Array([]);
  });

  describe('happy', () => {
    it('should return true when isString receives string input', () => {
      expect(isString('livon')).toBe(true);
    });

    it('should return true when isNumber receives finite number input', () => {
      expect(isNumber(42)).toBe(true);
    });

    it('should return true when isBoolean receives boolean input', () => {
      expect(isBoolean(false)).toBe(true);
    });

    it('should return true when isDate receives valid date input', () => {
      expect(isDate(validDate)).toBe(true);
    });

    it('should return true when isUint8Array receives uint8array input', () => {
      expect(isUint8Array(bytes)).toBe(true);
    });

    it('should return true when isRecord receives plain object input', () => {
      expect(isRecord({ id: 'u-1' })).toBe(true);
    });

    it('should return true when isArray guard receives array input', () => {
      const guard = isArray<string>();

      expect(guard(['a', 'b'])).toBe(true);
    });
  });

  describe('sad', () => {
    it('should return false when isString receives non-string input', () => {
      expect(isString(42)).toBe(false);
    });

    it('should return false when isNumber receives nan input', () => {
      expect(isNumber(Number.NaN)).toBe(false);
    });

    it('should return false when isBoolean receives non-boolean input', () => {
      expect(isBoolean('true')).toBe(false);
    });

    it('should return false when isDate receives invalid date input', () => {
      expect(isDate(invalidDate)).toBe(false);
    });

    it('should return false when isUint8Array receives non-uint8array input', () => {
      expect(isUint8Array([1, 2, 3])).toBe(false);
    });

    it('should return false when isRecord receives null input', () => {
      expect(isRecord(null)).toBe(false);
    });

    it('should return false when isRecord receives array input', () => {
      expect(isRecord(['a'])).toBe(false);
    });

    it('should return false when isArray guard receives non-array input', () => {
      const guard = isArray<string>();

      expect(guard({ value: 'x' })).toBe(false);
    });
  });
});
