import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstNode, SchemaBuildContext } from './types.js';
import { object } from './object.js';
import { schemaFactory } from './schemaFactory.js';
import { isRecord } from './typeGuards.js';
import {
  captureThrow,
  createBaseSchemaMock,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isRecord: vi.fn() }));

interface ObjectSchemaFactoryInput extends SchemaFactoryMockInput {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => Record<string, unknown>;
}

const schemaFactoryMock = vi.mocked(schemaFactory);
const isRecordMock = vi.mocked(isRecord);
const schemaFactoryImplementation = createSchemaFactoryMock();

const buildContextMock: SchemaBuildContext = {
  buildId: 'build-object',
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

const idSchemaMock = createBaseSchemaMock<string>({
  name: 'idSchema',
  parse: vi.fn((value: unknown) => `id:${String(value)}`),
  ast: vi.fn(() => ({ type: 'string', name: 'Id' })),
});

const ageSchemaMock = createBaseSchemaMock<number>({
  name: 'ageSchema',
  parse: vi.fn((value: unknown) => Number(value)),
  ast: vi.fn(() => ({ type: 'number', name: 'Age' })),
});

const getFactoryInput = (): ObjectSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as ObjectSchemaFactoryInput;
};

describe('object()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
    isRecordMock.mockImplementation(
      (value: unknown): value is Readonly<Record<string, unknown>> =>
        typeof value === 'object' && value !== null && !Array.isArray(value),
    );
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isRecordMock.mockClear();
    vi.mocked(idSchemaMock.parse).mockClear();
    vi.mocked(idSchemaMock.ast).mockClear();
    vi.mocked(ageSchemaMock.parse).mockClear();
    vi.mocked(ageSchemaMock.ast).mockClear();
  });

  afterEach(() => {
    vi.mocked(idSchemaMock.parse).mockClear();
    vi.mocked(ageSchemaMock.parse).mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isRecordMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when object schema is created', () => {
      const result = object({
        name: 'User',
        shape: { id: idSchemaMock, age: ageSchemaMock },
      });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('User');
      expect(factoryInput.type).toBe('object');
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should build field ast nodes when shape entries are provided', () => {
      object({
        name: 'User',
        shape: { id: idSchemaMock, age: ageSchemaMock },
      });
      const factoryInput = getFactoryInput();

      const ast = factoryInput.ast(schemaContextMock);

      expect(ast).toEqual({
        type: 'object',
        name: 'User',
        children: [
          { type: 'field', name: 'id', children: [{ type: 'string', name: 'Id' }] },
          { type: 'field', name: 'age', children: [{ type: 'number', name: 'Age' }] },
        ],
      });
      expect(idSchemaMock.ast).toHaveBeenCalledWith(buildContextMock);
      expect(ageSchemaMock.ast).toHaveBeenCalledWith(buildContextMock);
    });

    it('should parse each field when input is a record', () => {
      object({
        name: 'User',
        shape: { id: idSchemaMock, age: ageSchemaMock },
      });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate({ id: 'u1', age: '21' }, schemaContextMock);

      expect(parsed).toEqual({ id: 'id:u1', age: 21 });
      expect(idSchemaMock.parse).toHaveBeenCalledWith('u1', schemaContextMock);
      expect(ageSchemaMock.parse).toHaveBeenCalledWith('21', schemaContextMock);
    });
  });

  describe('sad', () => {
    it('should throw object.type when input is not a record', () => {
      isRecordMock.mockReturnValueOnce(false);
      object({
        name: 'User',
        shape: { id: idSchemaMock, age: ageSchemaMock },
      });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected object',
        code: 'object.type',
      });
    });
  });
});
