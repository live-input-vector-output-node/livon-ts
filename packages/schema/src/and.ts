import { Schema } from './types.js';

export interface AndInput<T, U> {
  left: Schema<T>;
  right: Schema<U>;
  name?: string;
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
 * // Extends a base message input schema with an id field.
 * const messageInput = object({
 *   name: 'MessageInput',
 *   shape: { text: string() },
 * });
 * const withId = object({
 *   name: 'WithId',
 *   shape: { id: string() },
 * });
 * const MessageWithId = and({ left: messageInput, right: withId });
 * MessageWithId.parse({ text: 'Hello', id: 'm-1' });
 *
 * @example
 * // Uses explicit naming for generated type surfaces.
 * const MessageWithId = and({
 *   left: messageInput,
 *   right: withId,
 *   name: 'MessageWithId',
 * });
 * MessageWithId.parse({ text: 'Hello', id: 'm-1' });
 */
export const and = <T, U>({ left, right, name }: AndInput<T, U>): Schema<T & U> =>
  name === undefined ? left.and(right) : left.and(right, { name });
