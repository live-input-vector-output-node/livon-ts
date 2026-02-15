import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Schema } from './types.js';
import { before } from './before.js';
import { captureThrow, createBaseSchemaMock } from './testing/mocks/index.js';

const schemaMock = createBaseSchemaMock<string>();
const nextSchemaMock = createBaseSchemaMock<string>({ name: 'next.before.schema' });
const hookMock = vi.fn((input: unknown) => input);

describe('before()', () => {
  beforeAll(() => {
    vi.mocked(schemaMock.before).mockImplementation(() => nextSchemaMock as Schema<string>);
  });

  beforeEach(() => {
    vi.mocked(schemaMock.before).mockClear();
    hookMock.mockClear();
  });

  afterEach(() => {
    vi.mocked(schemaMock.before).mockClear();
  });

  afterAll(() => {
    vi.mocked(schemaMock.before).mockReset();
  });

  describe('happy', () => {
    it('should delegate to schema.before when hook is provided', () => {
      const result = before({ schema: schemaMock, hook: hookMock });

      expect(schemaMock.before).toHaveBeenCalledTimes(1);
      expect(schemaMock.before).toHaveBeenCalledWith(hookMock);
      expect(result).toBe(nextSchemaMock);
    });
  });

  describe('sad', () => {
    it('should rethrow error when schema.before throws', () => {
      const beforeError = new Error('before hook failed');
      vi.mocked(schemaMock.before).mockImplementationOnce(() => {
        throw beforeError;
      });

      const thrown = captureThrow(() => before({ schema: schemaMock, hook: hookMock }));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toBe(beforeError);
    });
  });
});
