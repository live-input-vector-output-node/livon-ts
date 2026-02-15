import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Schema } from './types.js';
import { after } from './after.js';
import { captureThrow, createBaseSchemaMock } from './testing/mocks/index.js';

const schemaMock = createBaseSchemaMock<string>();
const nextSchemaMock = createBaseSchemaMock<number>({ name: 'next.after.schema' });
const hookMock = vi.fn((value: string) => value.length);

describe('after()', () => {
  beforeAll(() => {
    vi.mocked(schemaMock.after).mockImplementation(
      () => nextSchemaMock as unknown as Schema<unknown>,
    );
  });

  beforeEach(() => {
    vi.mocked(schemaMock.after).mockClear();
    hookMock.mockClear();
  });

  afterEach(() => {
    vi.mocked(schemaMock.after).mockClear();
  });

  afterAll(() => {
    vi.mocked(schemaMock.after).mockReset();
  });

  describe('happy', () => {
    it('should delegate to schema.after when hook is provided', () => {
      const result = after({ schema: schemaMock, hook: hookMock });

      expect(schemaMock.after).toHaveBeenCalledTimes(1);
      expect(schemaMock.after).toHaveBeenCalledWith(hookMock);
      expect(result).toBe(nextSchemaMock);
    });
  });

  describe('sad', () => {
    it('should rethrow error when schema.after throws', () => {
      const afterError = new Error('after hook failed');
      vi.mocked(schemaMock.after).mockImplementationOnce(() => {
        throw afterError;
      });

      const thrown = captureThrow(() => after({ schema: schemaMock, hook: hookMock }));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toBe(afterError);
    });
  });
});
