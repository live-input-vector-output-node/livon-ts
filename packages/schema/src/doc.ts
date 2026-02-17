import type { SchemaDoc } from './types.js';

/**
 * normalizeDoc is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/schema
 *
 * @example
 * const result = normalizeDoc(undefined as never);
 */
export const normalizeDoc = (doc?: SchemaDoc): Readonly<Record<string, unknown>> | undefined => {
  if (!doc) {
    return undefined;
  }
  if (typeof doc === 'string') {
    return { description: doc };
  }
  if (typeof doc === 'object' && !Array.isArray(doc)) {
    return doc;
  }
  return undefined;
};

/**
 * mergeDoc is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/schema
 *
 * @example
 * const result = mergeDoc(undefined as never);
 */
export const mergeDoc = (
  existing?: Readonly<Record<string, unknown>>,
  next?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined => {
  if (!existing && !next) {
    return undefined;
  }
  if (!existing) {
    return next;
  }
  if (!next) {
    return existing;
  }
  return { ...existing, ...next };
};
