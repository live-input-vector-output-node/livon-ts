import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { boolean } from './boolean.js';
import { schemaFactory } from './schemaFactory.js';
import { isBoolean } from './typeGuards.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isBoolean: vi.fn() }));

const schemaFactoryMock = vi.mocked(schemaFactory);
const isBooleanMock = vi.mocked(isBoolean);
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): SchemaFactoryMockInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as SchemaFactoryMockInput;
};

describe('boolean()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isBooleanMock.mockReset();
    isBooleanMock.mockReturnValue(true);
  });

  afterEach(() => {
    isBooleanMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isBooleanMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when using default metadata', () => {
      const result = boolean();

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('boolean');
      expect(factoryInput.type).toBe('boolean');
      expect(factoryInput.doc).toBeUndefined();
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'boolean', name: 'boolean' });
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass custom metadata to schemaFactory when options are provided', () => {
      const doc = { summary: 'bool doc' };

      boolean({ name: 'Flag', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Flag');
      expect(factoryInput.doc).toEqual(doc);
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'boolean', name: 'Flag' });
    });

    it('should validate input through isBoolean when input is boolean', () => {
      boolean();
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(true, schemaContextMock);

      expect(parsed).toBe(true);
      expect(isBooleanMock).toHaveBeenCalledWith(true);
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input is not a boolean', () => {
      isBooleanMock.mockReturnValue(false);
      boolean();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Data is not a boolean',
        code: 'boolean.type',
      });
    });
  });
});
