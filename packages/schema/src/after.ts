import { Schema } from './types.js';

export interface AfterInput<T> {
  schema: Schema<T>;
  hook: Parameters<Schema<T>['after']>[0];
}

/**
 * after is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/after
 *
 * @example
 * // Postprocesses validated string output by converting it to uppercase.
 * const UppercaseName = after({
 *   schema: string(),
 *   hook: (value: string) => value.toUpperCase(),
 * });
 * UppercaseName.parse('alice');
 *
 * @example
 * // Extends the postprocessed schema to also allow undefined.
 * const MaybeUppercaseName = after({
 *   schema: string(),
 *   hook: (value: string) => value.toUpperCase(),
 * }).optional();
 * MaybeUppercaseName.parse(undefined);
 */
export const after = <T>({ schema, hook }: AfterInput<T>) => schema.after(hook);
