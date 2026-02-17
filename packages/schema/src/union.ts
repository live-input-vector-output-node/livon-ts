import { OrSchemaInput, or } from './or.js';
import { Schema } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- union alias keeps heterogeneous schema options.
type AnySchema = Schema<any>;

/**
 * union is part of the public LIVON API.
 *
 * @remarks
 * `union` is an alias of `or`.
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/union
 *
 * @example
 * // Creates a union schema that accepts either string or number identifiers.
 * const Identifier = union({
 *   options: [string(), number()] as const,
 * });
 * Identifier.parse('user-1');
 *
 * @example
 * // Extends the union schema to also allow undefined.
 * const OptionalIdentifier = union({
 *   name: 'identifier',
 *   options: [string(), number()] as const,
 * }).optional();
 * OptionalIdentifier.parse(undefined);
 */
export type UnionSchemaInput<TValues extends readonly AnySchema[]> = OrSchemaInput<TValues>;

export const union = <TValues extends readonly AnySchema[]>(input: UnionSchemaInput<TValues>) => or(input);
