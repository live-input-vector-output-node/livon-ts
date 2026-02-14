import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { enumeration } from './enumeration.js';
import { schemaFactory } from './schemaFactory.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));

type EnumerationSchemaFactoryInput = Omit<SchemaFactoryMockInput, 'validate' | 'chain'> & {
  validate: (input: unknown, ctx: ReturnType<typeof createSchemaContextMock>) => string | number;
  chain: {
    literal: (data: string | number) => (only: string | number) => string | number;
  };
};

const schemaFactoryMock = vi.mocked(schemaFactory);
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): EnumerationSchemaFactoryInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as EnumerationSchemaFactoryInput;
};

describe('enumeration()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
  });

  afterEach(() => {
    schemaFactoryMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
  });

  describe('happy', () => {
    it('should return enum factory when enumeration is created', () => {
      const result = enumeration('Role');

      expect(typeof result.values).toBe('function');
      expect(schemaFactoryMock).toHaveBeenCalledTimes(0);
    });

    it('should delegate to schemaFactory when values() is called', () => {
      const result = enumeration('Role', { summary: 'enum doc' });
      const schema = result.values('user', 'admin');

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('enum:Role');
      expect(factoryInput.type).toBe('enum');
      expect(factoryInput.doc).toEqual({ summary: 'enum doc' });
      expect(factoryInput.ast(schemaContextMock)).toEqual({
        type: 'enum',
        name: 'Role',
        constraints: { values: ['user', 'admin'] },
      });
      expect(Object.keys(factoryInput.chain)).toEqual(['literal']);
      expect(schema).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should validate enum value and literal chain when values are included', () => {
      enumeration('Role').values('user', 'admin');
      const factoryInput = getFactoryInput();

      expect(factoryInput.validate('admin', schemaContextMock)).toBe('admin');
      expect(factoryInput.chain.literal('admin')('admin')).toBe('admin');
    });
  });

  describe('sad', () => {
    it('should throw enum.value when input is not part of values', () => {
      enumeration('Role').values('user', 'admin');
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('guest', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Input "guest" is not valid for enum "Role". Valid values: user, admin',
        code: 'enum.value',
        context: { name: 'Role', values: ['user', 'admin'] },
      });
    });

    it('should throw enum.literal when literal() does not match selected value', () => {
      enumeration('Role').values('user', 'admin');
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.chain.literal('user')('admin'));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Input "user" does not match literal "admin" for enum "Role".',
        code: 'enum.literal',
        context: { name: 'Role', only: 'admin' },
      });
    });
  });
});
