import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createSchemaValidationError } from './SchemaValidationError.js';
import type { SchemaErrorMeta, SchemaIssue } from './types.js';

describe('createSchemaValidationError()', () => {
  let issues: readonly SchemaIssue[];
  let meta: SchemaErrorMeta;

  beforeAll(() => {
    issues = [];
    meta = {};
  });

  beforeEach(() => {
    issues = [
      {
        path: ['user', 'name'],
        message: 'Expected non-empty value',
        code: 'string.min',
      },
    ];
    meta = {
      type: 'string',
      name: 'UserName',
    };
  });

  afterEach(() => {
    issues = [];
    meta = {};
  });

  afterAll(() => {
    issues = [];
    meta = {};
  });

  describe('happy', () => {
    it('should create error instance when issues are provided', () => {
      const error = createSchemaValidationError({ issues });

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toBe('Schema validation failed');
      expect(error.issues).toEqual(issues);
    });

    it('should attach meta when meta is provided', () => {
      const error = createSchemaValidationError({ issues, meta });

      expect(error.meta).toEqual(meta);
    });
  });

  describe('sad', () => {
    it('should keep meta undefined when meta is omitted', () => {
      const error = createSchemaValidationError({ issues });

      expect(error.meta).toBeUndefined();
    });
  });
});
