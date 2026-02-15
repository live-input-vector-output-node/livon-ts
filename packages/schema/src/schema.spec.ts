import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSchemaContext } from './context.js';
import {
  createGuardSchema,
  createIssueForPath,
  createPrimitiveSchema,
  createSchema,
  ensureSchemaContext,
  fail,
  ok,
} from './schema.js';
import type { SchemaContext } from './types.js';

describe('schema core utilities', () => {
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

  describe('createIssueForPath()', () => {
    describe('happy', () => {
      it('should create schema issue object when issue input is provided', () => {
        const issue = createIssueForPath({
          path: ['user', 'name'],
          message: 'Expected non-empty value',
          code: 'string.min',
          context: { min: 1 },
        });

        expect(issue).toEqual({
          path: ['user', 'name'],
          message: 'Expected non-empty value',
          code: 'string.min',
          context: { min: 1 },
        });
      });
    });

    describe('sad', () => {
      it('should keep optional fields undefined when optional values are omitted', () => {
        const issue = createIssueForPath({
          path: [],
          message: 'Invalid value',
        });

        expect(issue.code).toBeUndefined();
        expect(issue.context).toBeUndefined();
      });
    });
  });

  describe('ok()', () => {
    describe('happy', () => {
      it('should wrap value in ok result when value is provided', () => {
        const result = ok({ value: 'value' });

        expect(result).toEqual({
          ok: true,
          value: 'value',
        });
      });
    });

    describe('sad', () => {
      it('should keep undefined value when undefined is passed', () => {
        const result = ok({ value: undefined });

        expect(result).toEqual({
          ok: true,
          value: undefined,
        });
      });
    });
  });

  describe('fail()', () => {
    describe('happy', () => {
      it('should wrap issues and meta in fail result when both are provided', () => {
        const issues = [createIssueForPath({ path: [], message: 'invalid' })];
        const result = fail({
          issues,
          meta: { type: 'string', name: 'UserName' },
        });

        expect(result).toEqual({
          ok: false,
          issues,
          meta: { type: 'string', name: 'UserName' },
        });
      });
    });

    describe('sad', () => {
      it('should keep meta undefined when meta is omitted', () => {
        const result = fail({
          issues: [createIssueForPath({ path: [], message: 'invalid' })],
        });

        expect(result.meta).toBeUndefined();
      });
    });
  });

  describe('ensureSchemaContext()', () => {
    describe('happy', () => {
      it('should return provided context when context is provided', () => {
        const providedContext = createSchemaContext();

        const ensured = ensureSchemaContext(providedContext);

        expect(ensured).toBe(providedContext);
      });

      it('should create context with request when context is omitted', () => {
        const ensured = ensureSchemaContext();

        expect(ensured.getRequestContext()).toBeDefined();
      });
    });

    describe('sad', () => {
      it('should still return usable context when context is omitted', () => {
        const ensured = ensureSchemaContext();

        expect(() => ensured.state.snapshot()).not.toThrow();
      });
    });
  });

  describe('createSchema()', () => {
    describe('happy', () => {
      it('should parse value when validate returns ok result', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });

        const parsed = schema.parse(123, context);

        expect(parsed).toBe('123');
      });

      it('should type value when typed is called', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });

        const typed = schema.typed('abc', context);

        expect(typed).toBe('abc');
      });

      it('should return undefined when optional schema parses undefined', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) =>
            typeof input === 'string'
              ? ok({ value: input })
              : fail({ issues: [createIssueForPath({ path: [], message: 'Expected string' })] }),
        });
        const optionalSchema = schema.optional();

        const parsed = optionalSchema.parse(undefined, context);

        expect(parsed).toBeUndefined();
      });

      it('should return null when nullable schema parses null', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) =>
            typeof input === 'string'
              ? ok({ value: input })
              : fail({ issues: [createIssueForPath({ path: [], message: 'Expected string' })] }),
        });
        const nullableSchema = schema.nullable();

        const parsed = nullableSchema.parse(null, context);

        expect(parsed).toBeNull();
      });

      it('should merge doc into ast when describe is used', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string', name: 'StringSchema', doc: { source: 'base' } }),
          validate: (input) => ok({ value: String(input) }),
        });
        const described = schema.describe({ summary: 'description doc' });

        const ast = described.ast();

        expect(ast.doc).toEqual({
          source: 'base',
          summary: 'description doc',
        });
      });

      it('should keep value when refine predicate returns true', () => {
        const schema = createSchema({
          name: 'NumberSchema',
          type: 'number',
          ast: () => ({ type: 'number' }),
          validate: (input) => ok({ value: Number(input) }),
        });
        const refined = schema.refine({
          predicate: (value) => value > 0,
          message: 'Expected positive number',
          code: 'number.positive',
        });

        const parsed = refined.parse(10, context);

        expect(parsed).toBe(10);
      });

      it('should pass transformed input to base validator when before hook returns input object', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });
        const transformed = schema.before((input) => ({
          input: String(input).trim(),
        }));

        const parsed = transformed.parse('  Alice  ', context);

        expect(parsed).toBe('Alice');
      });

      it('should transform value when after hook returns value object', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });
        const transformed = schema.after((value) => ({
          value: value.toUpperCase(),
        }));

        const parsed = transformed.parse('alice', context);

        expect(parsed).toBe('ALICE');
      });

      it('should merge schemas when and schemas both validate successfully', () => {
        const left = createSchema({
          name: 'Left',
          type: 'left',
          ast: () => ({ type: 'left', name: 'Left' }),
          validate: () => ok({ value: { id: 'u-1' } }),
        });
        const right = createSchema({
          name: 'Right',
          type: 'right',
          ast: () => ({ type: 'right', name: 'Right' }),
          validate: () => ok({ value: { role: 'admin' } }),
        });
        const merged = left.and(right);

        const parsed = merged.parse('raw', context);
        const ast = merged.ast();

        expect(parsed).toEqual({ id: 'u-1' });
        expect(ast.type).toBe('and');
        expect(ast.children).toHaveLength(2);
      });

      it('should set fallback node name when ast result has no name', () => {
        const schema = createSchema({
          name: 'FallbackName',
          type: 'custom',
          ast: () => ({ type: 'custom' }),
          validate: (input) => ok({ value: input }),
        });

        const ast = schema.ast();

        expect(ast.name).toBe('FallbackName');
      });
    });

    describe('sad', () => {
      it('should throw validation error when validate returns fail result', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: () =>
            fail({
              issues: [createIssueForPath({ path: [], message: 'Expected string', code: 'string.type' })],
            }),
        });

        expect(() => schema.parse(1, context)).toThrowError('Schema validation failed');
      });

      it('should fail refine when predicate returns false', () => {
        const schema = createSchema({
          name: 'NumberSchema',
          type: 'number',
          ast: () => ({ type: 'number' }),
          validate: (input) => ok({ value: Number(input) }),
        });
        const refined = schema.refine({
          predicate: (value) => value > 10,
          message: 'Expected value greater than ten',
          code: 'number.greaterThanTen',
        });

        const result = refined.validate(5, context);

        expect(result).toEqual({
          ok: false,
          issues: [
            {
              path: [],
              message: 'Expected value greater than ten',
              code: 'number.greaterThanTen',
            },
          ],
          meta: expect.any(Object),
        });
      });

      it('should fail before validation when before hook returns issues', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });
        const withBefore = schema.before(() => ({
          issues: [createIssueForPath({ path: [], message: 'blocked by before hook' })],
        }));

        const result = withBefore.validate('value', context);

        expect(result).toEqual({
          ok: false,
          issues: [
            {
              path: [],
              message: 'blocked by before hook',
            },
          ],
          meta: expect.any(Object),
        });
      });

      it('should fail after validation when after hook returns issues', () => {
        const schema = createSchema({
          name: 'StringSchema',
          type: 'string',
          ast: () => ({ type: 'string' }),
          validate: (input) => ok({ value: String(input) }),
        });
        const withAfter = schema.after(() => ({
          issues: [createIssueForPath({ path: [], message: 'blocked by after hook' })],
        }));

        const result = withAfter.validate('value', context);

        expect(result).toEqual({
          ok: false,
          issues: [
            {
              path: [],
              message: 'blocked by after hook',
            },
          ],
          meta: expect.any(Object),
        });
      });

      it('should combine issues when and schema has failing left and right branches', () => {
        const leftIssue = createIssueForPath({ path: ['left'], message: 'left failed' });
        const rightIssue = createIssueForPath({ path: ['right'], message: 'right failed' });
        const left = createSchema({
          name: 'Left',
          type: 'left',
          ast: () => ({ type: 'left', name: 'Left' }),
          validate: () => fail({ issues: [leftIssue] }),
        });
        const right = createSchema({
          name: 'Right',
          type: 'right',
          ast: () => ({ type: 'right', name: 'Right' }),
          validate: () => fail({ issues: [rightIssue] }),
        });
        const merged = left.and(right);

        const result = merged.validate('raw', context);

        expect(result).toEqual({
          ok: false,
          issues: [leftIssue, rightIssue],
          meta: expect.any(Object),
        });
      });
    });
  });

  describe('createGuardSchema()', () => {
    describe('happy', () => {
      it('should parse value when guard returns true', () => {
        const schema = createGuardSchema({
          name: 'GuardedString',
          type: 'string',
          guard: (input): input is string => typeof input === 'string',
          message: 'Expected string',
          code: 'string.type',
        });

        const parsed = schema.parse('ok', context);

        expect(parsed).toBe('ok');
      });
    });

    describe('sad', () => {
      it('should fail when guard returns false', () => {
        const schema = createGuardSchema({
          name: 'GuardedString',
          type: 'string',
          guard: (input): input is string => typeof input === 'string',
          message: 'Expected string',
          code: 'string.type',
        });

        const result = schema.validate(1, context);

        expect(result).toEqual({
          ok: false,
          issues: [
            {
              path: [],
              message: 'Expected string',
              code: 'string.type',
            },
          ],
          meta: expect.any(Object),
        });
      });
    });
  });

  describe('createPrimitiveSchema()', () => {
    describe('happy', () => {
      it('should parse value when primitive guard returns true', () => {
        const schema = createPrimitiveSchema({
          name: 'PrimitiveString',
          type: 'string',
          guard: (input): input is string => typeof input === 'string',
          message: 'Expected string',
          code: 'string.type',
        });

        const parsed = schema.parse('ok', context);

        expect(parsed).toBe('ok');
      });
    });

    describe('sad', () => {
      it('should fail when primitive guard returns false', () => {
        const schema = createPrimitiveSchema({
          name: 'PrimitiveString',
          type: 'string',
          guard: (input): input is string => typeof input === 'string',
          message: 'Expected string',
          code: 'string.type',
        });

        const result = schema.validate(1, context);

        expect(result).toEqual({
          ok: false,
          issues: [
            {
              path: [],
              message: 'Expected string',
              code: 'string.type',
            },
          ],
          meta: expect.any(Object),
        });
      });
    });
  });

});
