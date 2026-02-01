import { Schema } from './types.js';

export interface AndInput<T, U> {
  left: Schema<T>;
  right: Schema<U>;
}

/**
 * and is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/and
 *
 * @example
 * const result = and(undefined as never);
 */
export const and = <T, U>({ left, right }: AndInput<T, U>): Schema<T & U> => left.and(right);
