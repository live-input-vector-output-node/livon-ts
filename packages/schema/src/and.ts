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
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/and
 *
 * @example
 * // Combines two object schemas into one schema that requires both shapes.
 * const WithId = object({ name: 'withId', shape: { id: string() } });
 * const WithAge = object({ name: 'withAge', shape: { age: number() } });
 * const User = and({ left: WithId, right: WithAge });
 * User.parse({ id: 'u1', age: 21 });
 *
 * @example
 * // Extends the combined schema to also allow undefined.
 * const OptionalUser = and({ left: WithId, right: WithAge }).optional();
 * OptionalUser.parse(undefined);
 */
export const and = <T, U>({ left, right }: AndInput<T, U>): Schema<T & U> => left.and(right);
