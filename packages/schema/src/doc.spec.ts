import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { mergeDoc, normalizeDoc } from './doc.js';
import type { SchemaDoc } from './types.js';

describe('doc utilities', () => {
  let stringDoc: SchemaDoc;
  let objectDoc: Readonly<Record<string, unknown>>;
  let existingDoc: Readonly<Record<string, unknown>>;
  let nextDoc: Readonly<Record<string, unknown>>;

  beforeAll(() => {
    stringDoc = '';
    objectDoc = {};
    existingDoc = {};
    nextDoc = {};
  });

  beforeEach(() => {
    stringDoc = 'User schema documentation';
    objectDoc = {
      summary: 'User',
      details: 'Contains user payload fields',
    };
    existingDoc = {
      summary: 'Existing summary',
      stable: true,
    };
    nextDoc = {
      summary: 'Next summary',
      deprecated: false,
    };
  });

  afterEach(() => {
    stringDoc = '';
    objectDoc = {};
    existingDoc = {};
    nextDoc = {};
  });

  afterAll(() => {
    stringDoc = '';
    objectDoc = {};
    existingDoc = {};
    nextDoc = {};
  });

  describe('normalizeDoc()', () => {
    describe('happy', () => {
      it('should return description record when doc is string', () => {
        const normalized = normalizeDoc(stringDoc);

        expect(normalized).toEqual({ description: stringDoc });
      });

      it('should return same record when doc is object', () => {
        const normalized = normalizeDoc(objectDoc);

        expect(normalized).toBe(objectDoc);
      });
    });

    describe('sad', () => {
      it('should return undefined when doc is missing', () => {
        const normalized = normalizeDoc(undefined);

        expect(normalized).toBeUndefined();
      });

      it('should return undefined when doc is array', () => {
        const normalized = normalizeDoc(['invalid'] as unknown as SchemaDoc);

        expect(normalized).toBeUndefined();
      });
    });
  });

  describe('mergeDoc()', () => {
    describe('happy', () => {
      it('should merge both records when existing and next are provided', () => {
        const merged = mergeDoc(existingDoc, nextDoc);

        expect(merged).toEqual({
          summary: 'Next summary',
          stable: true,
          deprecated: false,
        });
      });

      it('should return next when only next is provided', () => {
        const merged = mergeDoc(undefined, nextDoc);

        expect(merged).toBe(nextDoc);
      });

      it('should return existing when only existing is provided', () => {
        const merged = mergeDoc(existingDoc, undefined);

        expect(merged).toBe(existingDoc);
      });
    });

    describe('sad', () => {
      it('should return undefined when both values are missing', () => {
        const merged = mergeDoc(undefined, undefined);

        expect(merged).toBeUndefined();
      });
    });
  });
});
