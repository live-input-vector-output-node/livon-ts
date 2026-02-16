import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstNode, SchemaBuildContext } from './types.js';
import { schemaFactory } from './schemaFactory.js';
import { union } from './union.js';
import {
  captureThrow,
  createBaseSchemaMock,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));

interface UnionSchemaFactoryInput extends SchemaFactoryMockInput {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => unknown;
}

const schemaFactoryMock = vi.mocked(schemaFactory);
const schemaFactoryImplementation = createSchemaFactoryMock();

const buildContextMock: SchemaBuildContext = {
  buildId: 'build-union',
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

const firstOptionMock = createBaseSchemaMock<string>({
  name: 'firstOption',
  parse: vi.fn(() => {
    throw { code: 'first.fail' };
  }),
  ast: vi.fn(() => ({ type: 'string', name: 'FirstOption' })),
});

const secondOptionMock = createBaseSchemaMock<number>({
  name: 'secondOption',
  parse: vi.fn(() => 2),
  ast: vi.fn(() => ({ type: 'number', name: 'SecondOption' })),
});

const getFactoryInput = (): UnionSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as UnionSchemaFactoryInput;
};

describe('union()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    vi.mocked(firstOptionMock.parse).mockReset();
    vi.mocked(firstOptionMock.parse).mockImplementation(() => {
      throw { code: 'first.fail' };
    });
    vi.mocked(firstOptionMock.ast).mockClear();
    vi.mocked(secondOptionMock.parse).mockReset();
    vi.mocked(secondOptionMock.parse).mockReturnValue(2);
    vi.mocked(secondOptionMock.ast).mockClear();
  });

  afterEach(() => {
    vi.mocked(firstOptionMock.parse).mockClear();
    vi.mocked(secondOptionMock.parse).mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when union schema is created', () => {
      const result = union({
        name: 'TextOrCount',
        options: [firstOptionMock, secondOptionMock],
      });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('TextOrCount');
      expect(factoryInput.type).toBe('union');
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should build ast from option schemas when build context is available', () => {
      union({
        name: 'TextOrCount',
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      const ast = factoryInput.ast(schemaContextMock);

      expect(ast).toEqual({
        type: 'union',
        name: 'TextOrCount',
        children: [
          { type: 'string', name: 'FirstOption' },
          { type: 'number', name: 'SecondOption' },
        ],
      });
      expect(firstOptionMock.ast).toHaveBeenCalledWith(buildContextMock);
      expect(secondOptionMock.ast).toHaveBeenCalledWith(buildContextMock);
    });

    it('should return first successful parse result when one option matches', () => {
      union({
        name: 'TextOrCount',
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate('input', schemaContextMock);

      expect(parsed).toBe(2);
      expect(firstOptionMock.parse).toHaveBeenCalledWith('input', schemaContextMock);
      expect(secondOptionMock.parse).toHaveBeenCalledWith('input', schemaContextMock);
    });

    it('should derive schema name when union input omits name', () => {
      union({
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      expect(factoryInput.name).toBe('FirstOptionOrSecondOption');
      expect(factoryInput.ast(schemaContextMock)).toMatchObject({
        type: 'union',
        name: 'FirstOptionOrSecondOption',
      });
    });
  });

  describe('sad', () => {
    it('should throw union.match when no option matches', () => {
      vi.mocked(secondOptionMock.parse).mockImplementation(() => {
        throw { code: 'second.fail' };
      });
      union({
        name: 'TextOrCount',
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('input', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'No union match',
        code: 'union.match',
      });
    });
  });
});
