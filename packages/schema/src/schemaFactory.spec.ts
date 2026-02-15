import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSchemaContext } from './context.js';
import { captureThrow } from './testing/mocks/index.js';
import { guardFactory, schemaFactory } from './schemaFactory.js';
import type { AstNode, SchemaContext } from './types.js';

describe('schemaFactory()', () => {
  let astNode: AstNode;
  let context: SchemaContext;

  beforeAll(() => {
    astNode = { type: 'custom', name: 'Custom' };
    context = createSchemaContext();
  });

  beforeEach(() => {
    astNode = { type: 'custom', name: 'Custom' };
    context = createSchemaContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should create schema that parses validated value when validate succeeds', () => {
      const schema = schemaFactory({
        name: 'Custom',
        type: 'custom',
        ast: () => astNode,
        validate: (input) => String(input),
      });

      const parsed = schema.parse(123, context);

      expect(parsed).toBe('123');
      expect(schema.name).toBe('Custom');
      expect(schema.type).toBe('custom');
    });

    it('should merge schema level doc into ast when doc is provided', () => {
      const schema = schemaFactory({
        name: 'WithDoc',
        type: 'custom',
        doc: { summary: 'Schema doc' },
        ast: () => ({ type: 'custom', name: 'WithDoc', doc: { source: 'internal' } }),
        validate: (input) => input,
      });

      const ast = schema.ast();

      expect(ast.doc).toEqual({
        source: 'internal',
        summary: 'Schema doc',
      });
    });

    it('should build chained schema when chain method is called', () => {
      const plusOperation = vi.fn((value: number) => (step: number) => value + step);
      const schema = schemaFactory({
        name: 'Score',
        type: 'number',
        ast: () => ({ type: 'number', name: 'Score' }),
        validate: (input) => Number(input),
        chain: {
          plus: plusOperation,
        },
      });

      const plusSchema = schema.plus(2);
      const parsed = plusSchema.parse(3, context);

      expect(parsed).toBe(5);
      expect(plusOperation).toHaveBeenCalledWith(3, context);
      expect(plusSchema.name).toBe('Score.plus');
    });
  });

  describe('sad', () => {
    it('should convert thrown object into schema issue when validate throws error-like value', () => {
      const schema = schemaFactory({
        name: 'Failing',
        type: 'custom',
        ast: () => ({ type: 'custom', name: 'Failing' }),
        validate: () => {
          throw {
            message: 'Validation exploded',
            code: 'custom.fail',
            context: { reason: 'test' },
          };
        },
      });

      const thrown = captureThrow(() => schema.parse('x', context));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toMatchObject({
        message: 'Schema validation failed',
        issues: [
          {
            message: 'Validation exploded',
            code: 'custom.fail',
            context: { reason: 'test' },
          },
        ],
      });
    });

    it('should convert thrown primitive into default validation message when validate throws non-object', () => {
      const schema = schemaFactory({
        name: 'PrimitiveThrow',
        type: 'custom',
        ast: () => ({ type: 'custom', name: 'PrimitiveThrow' }),
        validate: () => {
          throw 'primitive failure';
        },
      });

      const thrown = captureThrow(() => schema.parse('x', context));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toMatchObject({
        issues: [
          {
            message: 'Schema validation failed',
          },
        ],
      });
    });
  });
});

describe('guardFactory()', () => {
  let context: SchemaContext;

  beforeAll(() => {
    context = createSchemaContext();
  });

  beforeEach(() => {
    context = createSchemaContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should return input value when guard accepts input', () => {
      const schema = guardFactory({
        name: 'GuardedString',
        type: 'string',
        guard: (input): input is string => typeof input === 'string',
        message: 'Expected string',
        code: 'string.type',
      });

      const parsed = schema.parse('ok', context);

      expect(parsed).toBe('ok');
      expect(schema.ast().type).toBe('string');
    });
  });

  describe('sad', () => {
    it('should throw schema validation error when guard rejects input', () => {
      const schema = guardFactory({
        name: 'GuardedString',
        type: 'string',
        guard: (input): input is string => typeof input === 'string',
        message: 'Expected string',
        code: 'string.type',
      });

      const thrown = captureThrow(() => schema.parse(1, context));

      expect(thrown.threw).toBe(true);
      expect(thrown.value).toMatchObject({
        issues: [
          {
            message: 'Expected string',
            code: 'string.type',
          },
        ],
      });
    });
  });
});
