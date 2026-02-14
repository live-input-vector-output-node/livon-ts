import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { date } from './date.js';
import { schemaFactory } from './schemaFactory.js';
import { isDate } from './typeGuards.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isDate: vi.fn() }));

const schemaFactoryMock = vi.mocked(schemaFactory);
const isDateMock = vi.mocked(isDate);
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): SchemaFactoryMockInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as SchemaFactoryMockInput;
};

describe('date()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isDateMock.mockReset();
    isDateMock.mockReturnValue(true);
  });

  afterEach(() => {
    isDateMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isDateMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when using default metadata', () => {
      const result = date();

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('date');
      expect(factoryInput.type).toBe('date');
      expect(factoryInput.doc).toBeUndefined();
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'date', name: 'date' });
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass custom metadata to schemaFactory when options are provided', () => {
      const doc = { summary: 'date doc' };

      date({ name: 'CreatedAt', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('CreatedAt');
      expect(factoryInput.doc).toEqual(doc);
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'date', name: 'CreatedAt' });
    });

    it('should validate input through isDate when input is Date', () => {
      const input = new Date('2025-02-01T00:00:00.000Z');
      date();
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(input, schemaContextMock);

      expect(parsed).toBe(input);
      expect(isDateMock).toHaveBeenCalledWith(input);
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input is not Date', () => {
      isDateMock.mockReturnValue(false);
      date();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected Date',
        code: 'date.type',
      });
    });
  });
});
