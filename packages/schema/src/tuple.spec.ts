import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstNode, SchemaBuildContext } from './types.js';
import { schemaFactory } from './schemaFactory.js';
import { tuple } from './tuple.js';
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

interface TupleSchemaFactoryInput extends SchemaFactoryMockInput {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => unknown[];
}

const schemaFactoryMock = vi.mocked(schemaFactory);
const isArrayMock = vi.mocked(isArray);
const schemaFactoryImplementation = createSchemaFactoryMock();
const isArrayGuardSpy = vi.fn((input: unknown) => Array.isArray(input));
const isArrayGuard = (input: unknown): input is unknown[] => isArrayGuardSpy(input);

const buildContextMock: SchemaBuildContext = {
  buildId: 'build-tuple',
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

const firstSchemaMock = createBaseSchemaMock<string>({
  name: 'first',
  parse: vi.fn((value: unknown) => `first:${String(value)}`),
  ast: vi.fn(() => ({ type: 'string', name: 'First' })),
});

const secondSchemaMock = createBaseSchemaMock<number>({
  name: 'second',
  parse: vi.fn((value: unknown) => Number(value)),
  ast: vi.fn(() => ({ type: 'number', name: 'Second' })),
});

const getFactoryInput = (): TupleSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as TupleSchemaFactoryInput;
};

describe('tuple()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
    isArrayMock.mockImplementation(() => isArrayGuard);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isArrayMock.mockClear();
    isArrayGuardSpy.mockClear();
    vi.mocked(firstSchemaMock.parse).mockClear();
    vi.mocked(firstSchemaMock.ast).mockClear();
    vi.mocked(secondSchemaMock.parse).mockClear();
    vi.mocked(secondSchemaMock.ast).mockClear();
  });

  afterEach(() => {
    vi.mocked(firstSchemaMock.parse).mockClear();
    vi.mocked(secondSchemaMock.parse).mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isArrayMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when tuple schema is created', () => {
      const result = tuple({
        name: 'Coordinates',
        items: [firstSchemaMock, secondSchemaMock],
      });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Coordinates');
      expect(factoryInput.type).toBe('tuple');
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should build ast from tuple item schemas when build context is available', () => {
      tuple({
        name: 'Coordinates',
        items: [firstSchemaMock, secondSchemaMock],
      });
      const factoryInput = getFactoryInput();

      const ast = factoryInput.ast(schemaContextMock);

      expect(ast).toEqual({
        type: 'tuple',
        name: 'Coordinates',
        children: [
          { type: 'string', name: 'First' },
          { type: 'number', name: 'Second' },
        ],
      });
      expect(firstSchemaMock.ast).toHaveBeenCalledWith(buildContextMock);
      expect(secondSchemaMock.ast).toHaveBeenCalledWith(buildContextMock);
    });

    it('should parse tuple elements when input is an array', () => {
      tuple({
        name: 'Coordinates',
        items: [firstSchemaMock, secondSchemaMock],
      });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(['x', '2'], schemaContextMock);

      expect(parsed).toEqual(['first:x', 2]);
      expect(firstSchemaMock.parse).toHaveBeenCalledWith('x', schemaContextMock);
      expect(secondSchemaMock.parse).toHaveBeenCalledWith('2', schemaContextMock);
    });
  });

  describe('sad', () => {
    it('should throw tuple.type when input is not an array', () => {
      isArrayGuardSpy.mockReturnValueOnce(false);
      tuple({
        name: 'Coordinates',
        items: [firstSchemaMock, secondSchemaMock],
      });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected tuple',
        code: 'tuple.type',
      });
    });
  });
});
