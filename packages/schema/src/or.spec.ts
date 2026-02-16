import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AstNode, SchemaBuildContext } from './types.js';
import { or } from './or.js';
import { schemaFactory } from './schemaFactory.js';
import {
  captureThrow,
  createBaseSchemaMock,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));

interface OrSchemaFactoryInput extends SchemaFactoryMockInput {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => unknown;
}

const schemaFactoryMock = vi.mocked(schemaFactory);
const schemaFactoryImplementation = createSchemaFactoryMock();

const buildContextMock: SchemaBuildContext = {
  buildId: 'build-or',
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

const unknownOptionMock = createBaseSchemaMock<string>({
  name: 'unknownOption',
  parse: vi.fn(() => 'unknown'),
  ast: vi.fn(() => ({ type: 'string', name: 'UnknownOption' })),
});

const getFactoryInput = (): OrSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as OrSchemaFactoryInput;
};

describe('or()', () => {
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
    vi.mocked(unknownOptionMock.parse).mockClear();
    vi.mocked(unknownOptionMock.ast).mockClear();
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
    it('should delegate to schemaFactory when or schema is created', () => {
      const result = or({
        name: 'Selector',
        options: [firstOptionMock, secondOptionMock],
      });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Selector');
      expect(factoryInput.type).toBe('or');
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should build ast from options when build context is available', () => {
      or({
        name: 'Selector',
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      const ast = factoryInput.ast(schemaContextMock);

      expect(ast).toEqual({
        type: 'union',
        name: 'Selector',
        children: [
          { type: 'string', name: 'FirstOption' },
          { type: 'number', name: 'SecondOption' },
        ],
      });
      expect(firstOptionMock.ast).toHaveBeenCalledWith(buildContextMock);
      expect(secondOptionMock.ast).toHaveBeenCalledWith(buildContextMock);
    });

    it('should fall back to option matching when discriminator is missing', () => {
      or({
        name: 'Selector',
        options: [firstOptionMock, secondOptionMock],
      });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate('input', schemaContextMock);

      expect(parsed).toBe(2);
      expect(firstOptionMock.parse).toHaveBeenCalledWith('input', schemaContextMock);
      expect(secondOptionMock.parse).toHaveBeenCalledWith('input', schemaContextMock);
    });

    it('should use discriminator option when discriminator returns known schema', () => {
      const discriminator = vi.fn(() => secondOptionMock);
      or({
        name: 'Selector',
        options: [firstOptionMock, secondOptionMock],
        discriminator,
      });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate('input', schemaContextMock);

      expect(parsed).toBe(2);
      expect(discriminator).toHaveBeenCalledWith('input', schemaContextMock);
      expect(firstOptionMock.parse).not.toHaveBeenCalled();
      expect(secondOptionMock.parse).toHaveBeenCalledWith('input', schemaContextMock);
    });

    it('should derive schema name when or input omits name', () => {
      or({
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
    it('should throw or.discriminator when discriminator returns unknown schema', () => {
      const discriminator = vi.fn(() => unknownOptionMock);
      or({
        name: 'Selector',
        options: [firstOptionMock, secondOptionMock],
        discriminator,
      });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('input', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Discriminator selected an unknown schema option.',
        code: 'or.discriminator',
      });
    });

    it('should throw union.match when no option matches', () => {
      vi.mocked(secondOptionMock.parse).mockImplementation(() => {
        throw { code: 'second.fail' };
      });
      or({
        name: 'Selector',
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
