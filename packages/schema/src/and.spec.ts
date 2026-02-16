import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Schema } from './types.js';
import { and } from './and.js';
import { captureThrow, createBaseSchemaMock } from './testing/mocks/index.js';

const leftSchemaMock = createBaseSchemaMock<{ left: true }>({ name: 'left' });
const rightSchemaMock = createBaseSchemaMock<{ right: true }>({ name: 'right' });
const mergedSchemaMock = createBaseSchemaMock<{ left: true; right: true }>({
  name: 'merged',
});

describe('and()', () => {
  beforeAll(() => {
    vi.mocked(leftSchemaMock.and).mockImplementation(
      ((() =>
        mergedSchemaMock as unknown as Schema<{ left: true } & { right: true }>) as unknown) as Schema<{
        left: true;
      }>['and'],
    );
  });

  beforeEach(() => {
    vi.mocked(leftSchemaMock.and).mockClear();
  });

  afterEach(() => {
    vi.mocked(leftSchemaMock.and).mockClear();
  });

  afterAll(() => {
    vi.mocked(leftSchemaMock.and).mockReset();
  });

  describe('happy', () => {
    it('should delegate to left.and when right schema is provided', () => {
      const result = and({ left: leftSchemaMock, right: rightSchemaMock });

      expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
      expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
      expect(result).toBe(mergedSchemaMock);
    });

    it('should pass name override when and input includes name', () => {
      and({ left: leftSchemaMock, right: rightSchemaMock, name: 'MessageWithId' });

      expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
      expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock, { name: 'MessageWithId' });
    });
  });

  describe('sad', () => {
    it('should rethrow error when left.and throws', () => {
      const andError = new Error('and failed');
      vi.mocked(leftSchemaMock.and).mockImplementationOnce(() => {
        throw andError;
      });

      const thrown = captureThrow(() => and({ left: leftSchemaMock, right: rightSchemaMock }));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toBe(andError);
    });
  });
});
