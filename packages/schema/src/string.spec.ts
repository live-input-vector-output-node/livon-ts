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
import { schemaFactory } from './schemaFactory.js';
import { string } from './string.js';
import { isString } from './typeGuards.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isString: vi.fn() }));

type StringSchemaFactoryInput = Omit<SchemaFactoryMockInput, 'validate' | 'chain'> & {
  validate: (input: unknown, ctx: SchemaContext) => string;
  chain: {
    min: (data: string, ctx: SchemaContext) => (min: number) => string;
    max: (data: string, ctx: SchemaContext) => (max: number) => string;
    email: (data: string, ctx: SchemaContext) => () => string;
    regex: (data: string, ctx: SchemaContext) => (pattern: RegExp) => string;
  };
};

const schemaFactoryMock = vi.mocked(schemaFactory);
const isStringMock = vi.mocked(isString) as MockedFunction<typeof isString>;
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): StringSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as StringSchemaFactoryInput;
};

describe('string()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isStringMock.mockReset();
    isStringMock.mockReturnValue(true);
  });

  afterEach(() => {
    isStringMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isStringMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when string schema is created', () => {
      const result = string();

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('string');
      expect(factoryInput.type).toBe('string');
      expect(factoryInput.ast(schemaContextMock)).toEqual({
        type: 'string',
        name: 'string',
      });
      expect(Object.keys(factoryInput.chain)).toEqual(['min', 'max', 'email', 'regex']);
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass custom metadata to schemaFactory when options are provided', () => {
      const doc = { summary: 'string doc' };

      string({ name: 'Title', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Title');
      expect(factoryInput.doc).toEqual(doc);
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'string', name: 'Title' });
    });

    it('should validate input through isString when input is string', () => {
      string();
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate('abc', schemaContextMock);

      expect(parsed).toBe('abc');
      expect(isStringMock).toHaveBeenCalledWith('abc');
    });

    it('should return input for all chain methods when constraints are valid', () => {
      string();
      const factoryInput = getFactoryInput();

      expect(factoryInput.chain.min('abcd', schemaContextMock)(3)).toBe('abcd');
      expect(factoryInput.chain.max('abcd', schemaContextMock)(5)).toBe('abcd');
      expect(factoryInput.chain.email('a@b.c', schemaContextMock)()).toBe('a@b.c');
      expect(factoryInput.chain.regex('abc-123', schemaContextMock)(/^[a-z]+-\d+$/)).toBe(
        'abc-123',
      );
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input is not string', () => {
      isStringMock.mockReturnValue(false);
      string();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate(10, schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Data is not a string',
        code: 'string.type',
      });
    });

    it('should throw min error when input length is below minimum', () => {
      string();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.min('ab', schemaContextMock)(3));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'String is too short',
        code: 'string.min',
        context: { min: 3 },
      });
    });

    it('should throw max error when input length is above maximum', () => {
      string();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.max('abcdef', schemaContextMock)(5));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'String is too long',
        code: 'string.max',
        context: { max: 5 },
      });
    });

    it('should throw email error when input is not an email', () => {
      string();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.email('abc', schemaContextMock)());

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Invalid email format',
        code: 'string.email',
      });
    });

    it('should throw regex error when input does not match pattern', () => {
      string();
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() =>
        factoryInput.chain.regex('abc', schemaContextMock)(/^\d+$/),
      );

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'String does not match pattern',
        code: 'string.regex',
        context: { pattern: '^\\d+$' },
      });
    });
  });
});
