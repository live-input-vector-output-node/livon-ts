import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { literal } from './literal.js';
import { schemaFactory } from './schemaFactory.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));

const schemaFactoryMock = vi.mocked(schemaFactory);
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): SchemaFactoryMockInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as SchemaFactoryMockInput;
};

describe('literal()', () => {
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
    it('should delegate to schemaFactory when literal metadata is provided', () => {
      const result = literal({ name: 'Room', value: 'global' });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Room');
      expect(factoryInput.type).toBe('literal<global>');
      expect(factoryInput.ast(schemaContextMock)).toEqual({
        type: 'literal',
        name: 'Room',
        constraints: { value: 'global' },
      });
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass doc metadata to schemaFactory when doc is provided', () => {
      const doc = { summary: 'literal doc' };
      literal({ name: 'Mode', value: 'fast', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.doc).toEqual(doc);
    });

    it('should return literal value when input matches literal', () => {
      literal({ name: 'Flag', value: true });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(true, schemaContextMock);

      expect(parsed).toBe(true);
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input does not match literal', () => {
      literal({ name: 'Flag', value: false });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate(true, schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected false',
        code: 'literal.value',
      });
    });
  });
});
