import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstNode, SchemaBuildContext } from './types.js';
import { array } from './array.js';
import { schemaFactory } from './schemaFactory.js';
import { isArray } from './typeGuards.js';
import {
  captureThrow,
  createBaseSchemaMock,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isArray: vi.fn() }));

interface ArraySchemaFactoryInput extends SchemaFactoryMockInput {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => unknown[];
}

const schemaFactoryMock = vi.mocked(schemaFactory);
const isArrayMock = vi.mocked(isArray);
const schemaFactoryImplementation = createSchemaFactoryMock();
const isArrayGuardSpy = vi.fn((input: unknown) => Array.isArray(input));
const isArrayGuard = (input: unknown): input is unknown[] => isArrayGuardSpy(input);

const buildContextMock: SchemaBuildContext = {
  buildId: 'build-array',
  builder: {
    add: vi.fn((node: AstNode) => node),
    getAll: vi.fn(() => []),
  },
  schemaPath: [],
  buildOptions: {},
};

const schemaContextMock = createSchemaContextMock({
  buildContext: buildContextMock,
});

const itemSchemaMock = createBaseSchemaMock<string>({
  name: 'itemSchema',
  parse: vi.fn((input: unknown) => `parsed:${String(input)}`),
  ast: vi.fn(() => ({ type: 'string', name: 'Item' })),
});

const getFactoryInput = (): ArraySchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as ArraySchemaFactoryInput;
};

describe('array()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
    isArrayMock.mockImplementation(() => isArrayGuard);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isArrayMock.mockClear();
    isArrayGuardSpy.mockClear();
    vi.mocked(itemSchemaMock.parse).mockClear();
    vi.mocked(itemSchemaMock.ast).mockClear();
  });

  afterEach(() => {
    vi.mocked(itemSchemaMock.parse).mockClear();
    isArrayGuardSpy.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isArrayMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when array schema is created', () => {
      const result = array({ name: 'Tags', item: itemSchemaMock });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Tags');
      expect(factoryInput.type).toBe('array<itemSchema>');
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should build ast from item schema when build context is available', () => {
      array({ name: 'Tags', item: itemSchemaMock });
      const factoryInput = getFactoryInput();

      const ast = factoryInput.ast(schemaContextMock);

      expect(ast).toEqual({
        type: 'array',
        name: 'Tags',
        children: [{ type: 'string', name: 'Item' }],
      });
      expect(itemSchemaMock.ast).toHaveBeenCalledWith(buildContextMock);
    });

    it('should validate all items when input is an array', () => {
      array({ name: 'Tags', item: itemSchemaMock });
      const factoryInput = getFactoryInput();

      const result = factoryInput.validate(['a', 'b'], schemaContextMock);

      expect(result).toEqual(['parsed:a', 'parsed:b']);
      expect(isArrayMock).toHaveBeenCalledTimes(1);
      expect(isArrayGuardSpy).toHaveBeenCalledWith(['a', 'b']);
      expect(itemSchemaMock.parse).toHaveBeenNthCalledWith(1, 'a', schemaContextMock);
      expect(itemSchemaMock.parse).toHaveBeenNthCalledWith(2, 'b', schemaContextMock);
    });
  });

  describe('sad', () => {
    it('should throw array.type when input is not an array', () => {
      isArrayGuardSpy.mockReturnValueOnce(false);
      array({ name: 'Tags', item: itemSchemaMock });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected array',
        code: 'array.type',
      });
    });

    it('should throw array.item with index context when item parse fails', () => {
      const itemFailure = { message: 'item failed', code: 'item.invalid' };
      vi.mocked(itemSchemaMock.parse)
        .mockReturnValueOnce('parsed:a')
        .mockImplementationOnce(() => {
          throw itemFailure;
        });

      array({ name: 'Tags', item: itemSchemaMock });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate(['a', 'b'], schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Invalid item at index 1',
        code: 'array.item',
        context: { index: 1, error: itemFailure },
      });
    });
  });
});
