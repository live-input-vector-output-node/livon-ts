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
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/before
 *
 * @example
 * // Preprocesses string input by trimming whitespace before validation.
 * const TrimmedName = before({
 *   schema: string(),
 *   hook: (input) => (typeof input === 'string' ? input.trim() : input),
 * });
 * TrimmedName.parse('  alice  ');
 *
 * @example
 * // Extends the preprocessed schema to also allow undefined.
 * const OptionalTrimmedName = before({
 *   schema: string(),
 *   hook: (input) => (typeof input === 'string' ? input.trim() : input),
 * }).optional();
 * OptionalTrimmedName.parse(undefined);
 */
export const before = <T>({ schema, hook }: BeforeInput<T>): Schema<T> => schema.before(hook);
