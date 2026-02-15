import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import * as schema from './index.js';

describe('index exports', () => {
  beforeAll(() => {
    // no-op setup for consistent test structure
  });

  beforeEach(() => {
    // no-op setup for consistent test structure
  });

  afterEach(() => {
    // no-op cleanup for consistent test structure
  });

  afterAll(() => {
    // no-op cleanup for consistent test structure
  });

  describe('happy', () => {
    it('should expose schema builder functions when package entrypoint is imported', () => {
      expect(typeof schema.string).toBe('function');
      expect(typeof schema.number).toBe('function');
      expect(typeof schema.object).toBe('function');
      expect(typeof schema.array).toBe('function');
      expect(typeof schema.union).toBe('function');
      expect(typeof schema.or).toBe('function');
      expect(typeof schema.tuple).toBe('function');
      expect(typeof schema.literal).toBe('function');
      expect(typeof schema.binary).toBe('function');
    });

    it('should expose api and runtime integration helpers when package entrypoint is imported', () => {
      expect(typeof schema.api).toBe('function');
      expect(typeof schema.composeApi).toBe('function');
      expect(typeof schema.subscription).toBe('function');
      expect(typeof schema.operation).toBe('function');
      expect(typeof schema.fieldOperation).toBe('function');
      expect(typeof schema.schemaModule).toBe('function');
      expect(typeof schema.createSchemaModuleInput).toBe('function');
    });
  });

  describe('sad', () => {
    it('should keep typeGuards namespace defined when package entrypoint is imported', () => {
      expect(schema.typeGuards).toBeDefined();
      expect(typeof schema.typeGuards.isString).toBe('function');
      expect(typeof schema.typeGuards.isRecord).toBe('function');
    });
  });
});
