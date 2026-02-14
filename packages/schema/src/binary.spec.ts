import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { binary } from './binary.js';
import { schemaFactory } from './schemaFactory.js';
import { isUint8Array } from './typeGuards.js';
import {
  captureThrow,
  createSchemaContextMock,
  createSchemaFactoryMock,
  type SchemaFactoryMockInput,
} from './testing/mocks/index.js';

vi.mock('./schemaFactory.js', () => ({ schemaFactory: vi.fn() }));
vi.mock('./typeGuards.js', () => ({ isUint8Array: vi.fn() }));

const schemaFactoryMock = vi.mocked(schemaFactory);
const isUint8ArrayMock = vi.mocked(isUint8Array);
const schemaContextMock = createSchemaContextMock();
const schemaFactoryImplementation = createSchemaFactoryMock();

const getFactoryInput = (): SchemaFactoryMockInput => {
  const call = schemaFactoryMock.mock.calls[0];
  if (!call) {
    throw new Error('schemaFactory should be called once before reading input');
  }
  return call[0] as SchemaFactoryMockInput;
};

describe('binary()', () => {
  beforeAll(() => {
    schemaFactoryMock.mockImplementation(schemaFactoryImplementation);
  });

  beforeEach(() => {
    schemaFactoryMock.mockClear();
    schemaFactoryImplementation.mockClear();
    isUint8ArrayMock.mockReset();
    isUint8ArrayMock.mockReturnValue(true);
  });

  afterEach(() => {
    isUint8ArrayMock.mockClear();
  });

  afterAll(() => {
    schemaFactoryMock.mockReset();
    schemaFactoryImplementation.mockReset();
    isUint8ArrayMock.mockReset();
  });

  describe('happy', () => {
    it('should delegate to schemaFactory when binary input metadata is provided', () => {
      const result = binary({ name: 'Attachment' });

      expect(schemaFactoryMock).toHaveBeenCalledTimes(1);
      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Attachment');
      expect(factoryInput.type).toBe('binary');
      expect(factoryInput.doc).toBeUndefined();
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'binary', name: 'Attachment' });
      expect(result).toBe(schemaFactoryMock.mock.results[0]?.value);
    });

    it('should pass doc metadata to schemaFactory when doc is provided', () => {
      const doc = { summary: 'binary doc' };

      binary({ name: 'Payload', doc });

      const factoryInput = getFactoryInput();
      expect(factoryInput.name).toBe('Payload');
      expect(factoryInput.doc).toEqual(doc);
      expect(factoryInput.ast(schemaContextMock)).toEqual({ type: 'binary', name: 'Payload' });
    });

    it('should validate input through isUint8Array when input is Uint8Array', () => {
      const input = new Uint8Array([9, 8, 7]);
      binary({ name: 'Blob' });
      const factoryInput = getFactoryInput();

      const parsed = factoryInput.validate(input, schemaContextMock);

      expect(parsed).toBe(input);
      expect(isUint8ArrayMock).toHaveBeenCalledWith(input);
    });
  });

  describe('sad', () => {
    it('should throw schema error payload when input is not Uint8Array', () => {
      isUint8ArrayMock.mockReturnValue(false);
      binary({ name: 'Blob' });
      const factoryInput = getFactoryInput();

      const thrown = captureThrow(() => factoryInput.validate('x', schemaContextMock));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toEqual({
        message: 'Expected Uint8Array',
        code: 'binary.type',
      });
    });
  });
});
