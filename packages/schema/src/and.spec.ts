import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Schema } from './types.js';
import { and } from './and.js';
import { captureThrow, createBaseSchemaMock } from './testing/mocks/index.js';

const leftSchemaMock = createBaseSchemaMock<{ left: true }>({ name: 'left' });
const rightSchemaMock = createBaseSchemaMock<{ right: true }>({ name: 'right' });
const thirdSchemaMock = createBaseSchemaMock<{ third: true }>({ name: 'third' });
const fourthSchemaMock = createBaseSchemaMock<{ fourth: true }>({ name: 'fourth' });
const mergedSchemaMock = createBaseSchemaMock<{ left: true; right: true }>({
  name: 'merged',
});
const mergedWithThirdSchemaMock = createBaseSchemaMock<{ left: true; right: true; third: true }>({
  name: 'mergedWithThird',
});
const mergedWithFourthSchemaMock = createBaseSchemaMock<{
  left: true;
  right: true;
  third: true;
  fourth: true;
}>({
  name: 'mergedWithFourth',
});

describe('and()', () => {
  beforeAll(() => {
    vi.mocked(leftSchemaMock.and).mockImplementation(
      ((() =>
        mergedSchemaMock as unknown as Schema<{ left: true } & { right: true }>) as unknown) as Schema<{
        left: true;
      }>['and'],
    );
    vi.mocked(mergedSchemaMock.and).mockImplementation(
      ((() =>
        mergedWithThirdSchemaMock as unknown as Schema<
          { left: true; right: true } & { third: true }
        >) as unknown) as Schema<{ left: true; right: true }>['and'],
    );
    vi.mocked(mergedWithThirdSchemaMock.and).mockImplementation(
      ((() =>
        mergedWithFourthSchemaMock as unknown as Schema<
          { left: true; right: true; third: true } & { fourth: true }
        >) as unknown) as Schema<{ left: true; right: true; third: true }>['and'],
    );
  });

  beforeEach(() => {
    vi.mocked(leftSchemaMock.and).mockClear();
    vi.mocked(mergedSchemaMock.and).mockClear();
    vi.mocked(mergedWithThirdSchemaMock.and).mockClear();
  });

  afterEach(() => {
    vi.mocked(leftSchemaMock.and).mockClear();
    vi.mocked(mergedSchemaMock.and).mockClear();
    vi.mocked(mergedWithThirdSchemaMock.and).mockClear();
  });

  afterAll(() => {
    vi.mocked(leftSchemaMock.and).mockReset();
    vi.mocked(mergedSchemaMock.and).mockReset();
    vi.mocked(mergedWithThirdSchemaMock.and).mockReset();
  });

  describe('legacy API: { left, right }', () => {
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

  describe('new API: { schemas }', () => {
    describe('happy', () => {
      it('should chain two schemas when schemas array has 2 items', () => {
        const schemas = [leftSchemaMock, rightSchemaMock] as const;
        const result = and({
          schemas,
        });

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
        expect(result).toBe(mergedSchemaMock);
      });

      it('should chain three schemas when schemas array has 3 items', () => {
        const schemas = [leftSchemaMock, rightSchemaMock, thirdSchemaMock] as const;
        const result = and({
          schemas,
        });

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
        expect(mergedSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(mergedSchemaMock.and).toHaveBeenCalledWith(thirdSchemaMock);
        expect(result).toBe(mergedWithThirdSchemaMock);
      });

      it('should pass name to last .and() call when name is provided with 2 schemas', () => {
        const schemas = [leftSchemaMock, rightSchemaMock] as const;
        and({
          schemas,
          name: 'CustomName',
        });

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock, { name: 'CustomName' });
      });

      it('should pass name to last .and() call when name is provided with 3 schemas', () => {
        const schemas = [leftSchemaMock, rightSchemaMock, thirdSchemaMock] as const;
        and({
          schemas,
          name: 'CustomName',
        });

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
        expect(mergedSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(mergedSchemaMock.and).toHaveBeenCalledWith(thirdSchemaMock, { name: 'CustomName' });
      });

      it('should chain four schemas in order when schemas array has 4 items', () => {
        const schemas = [leftSchemaMock, rightSchemaMock, thirdSchemaMock, fourthSchemaMock] as const;
        const result = and({
          schemas,
        });

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
        expect(mergedSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(mergedSchemaMock.and).toHaveBeenCalledWith(thirdSchemaMock);
        expect(mergedWithThirdSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(mergedWithThirdSchemaMock.and).toHaveBeenCalledWith(fourthSchemaMock);
        expect(result).toBe(mergedWithFourthSchemaMock);
      });
    });

    describe('sad', () => {
      it('should throw error when schemas array has less than 2 items', () => {
        const thrown = captureThrow(() =>
          and({ schemas: [leftSchemaMock] as unknown as readonly [Schema<unknown>, Schema<unknown>] }),
        );

        expect(thrown.threw).toBe(true);
        expect(thrown.value).toBeInstanceOf(Error);
        expect((thrown.value as Error).message).toBe('and() requires at least 2 schemas in the schemas array');
      });

      it('should throw error when schemas array is empty', () => {
        const thrown = captureThrow(() =>
          and({ schemas: [] as unknown as readonly [Schema<unknown>, Schema<unknown>] }),
        );

        expect(thrown.threw).toBe(true);
        expect(thrown.value).toBeInstanceOf(Error);
        expect((thrown.value as Error).message).toBe('and() requires at least 2 schemas in the schemas array');
      });

      it('should rethrow error when intermediate chained .and() throws in multi-schema mode', () => {
        const andError = new Error('chained and failed');
        vi.mocked(mergedSchemaMock.and).mockImplementationOnce(() => {
          throw andError;
        });

        const thrown = captureThrow(() =>
          and({
            schemas: [leftSchemaMock, rightSchemaMock, thirdSchemaMock],
          }),
        );

        expect(leftSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(leftSchemaMock.and).toHaveBeenCalledWith(rightSchemaMock);
        expect(mergedSchemaMock.and).toHaveBeenCalledTimes(1);
        expect(mergedSchemaMock.and).toHaveBeenCalledWith(thirdSchemaMock);
        expect(thrown.threw).toBe(true);
        expect(thrown.value).toBe(andError);
      });
    });
  });
});
