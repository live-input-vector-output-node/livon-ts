import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type MockedFunction,
} from 'vitest';

import type { SchemaContext } from './types.js';
import { number } from './number.js';
import { schemaFactory } from './schemaFactory.js';
import { isNumber } from './typeGuards.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isNumber: vi.fn() }));

type NumberSchemaFactoryInput = Omit<SchemaFactoryMockInput, 'validate' | 'chain'> & {
  validate: (input: unknown, ctx: SchemaContext) => number;
  chain: {
    min: (data: number, ctx: SchemaContext) => (min: number) => number;
    max: (data: number, ctx: SchemaContext) => (max: number) => number;
    int: (data: number, ctx: SchemaContext) => () => number;
    positive: (data: number, ctx: SchemaContext) => () => number;
  };
};

const schemaFactoryMock = vi.mocked(schemaFactory);
const isNumberMock = vi.mocked(isNumber) as MockedFunction<typeof isNumber>;
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): NumberSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as NumberSchemaFactoryInput;
};

describe('number()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isNumberMock.mockReset();
    isNumberMock.mockReturnValue(true);
  });

  afterEach(() => {
    isNumberMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isNumberMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when number schema is created', () => {
      const result = number();

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('number');
      expect(factoryInput.type).toBe('number');
      expect(factoryInput.ast(schemaContextMock)).toEqual({
        type: 'number',
        name: 'number',
      });
      expect(Object.keys(factoryInput.chain)).toEqual([
        'min',
        'max',
        'int',
        'positive',
      ]);
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass custom metadata to schemaFactory when options are provided', () => {
      const doc = { summary: 'number doc' };

      number({ name: 'Count', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Count');
      expect(factoryInput.doc).toEqual(doc);
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'number', name: 'Count' });
    });

    it('should validate input through isNumber when input is number', () => {
      number();
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(42, schemaContextMock);

      expect(parsed).toBe(42);
      expect(isNumberMock).toHaveBeenCalledWith(42);
    });

    it('should return input for all chain methods when constraints are valid', () => {
      number();
      const factoryInput = getFactoryInput();

      expect(factoryInput.chain.min(5, schemaContextMock)(1)).toBe(5);
      expect(factoryInput.chain.max(5, schemaContextMock)(8)).toBe(5);
      expect(factoryInput.chain.int(5, schemaContextMock)()).toBe(5);
      expect(factoryInput.chain.positive(5, schemaContextMock)()).toBe(5);
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input is not number', () => {
      isNumberMock.mockReturnValue(false);
      number();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Data is not a number',
        code: 'number.type',
      });
    });

    it('should throw min error when value is below minimum', () => {
      number();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.min(1, schemaContextMock)(5));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected number >= 5',
        code: 'number.min',
        context: { min: 5 },
      });
    });

    it('should throw max error when value is above maximum', () => {
      number();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.max(10, schemaContextMock)(8));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected number <= 8',
        code: 'number.max',
        context: { max: 8 },
      });
    });

    it('should throw int error when value is not integer', () => {
      number();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.int(2.5, schemaContextMock)());

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected integer',
        code: 'number.int',
      });
    });

    it('should throw positive error when value is not positive', () => {
      number();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.positive(0, schemaContextMock)());

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected positive number',
        code: 'number.positive',
      });
    });
  });
});
