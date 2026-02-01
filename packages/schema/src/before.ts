import { Schema } from './types.js';

export interface BeforeInput<T> {
  schema: Schema<T>;
  hook: Parameters<Schema<T>['before']>[0];
}

/**
 * before is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/before
 *
 * @example
 * const result = before(undefined as never);
 */
export const before = <T>({ schema, hook }: BeforeInput<T>): Schema<T> => schema.before(hook);
