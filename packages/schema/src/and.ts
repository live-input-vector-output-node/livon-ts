import { Infer, Schema, SchemaLike } from './types.js';

type InferSchemasTuple<T extends readonly SchemaLike[]> = {
  [K in keyof T]: Infer<T[K]>;
};

type IntersectTuple<T extends readonly unknown[]> = T extends readonly [infer Head, ...infer Tail]
  ? Head & IntersectTuple<Tail>
  : unknown;

interface AndReduceState {
  schema: Schema<unknown>;
  index: number;
}

export interface AndSchemaInput<TSchemas extends readonly SchemaLike[]> {
  name?: string;
  schemas: TSchemas;
}

export interface AndLegacyInput<T, U> {
  left: Schema<T>;
  right: Schema<U>;
  name?: string;
}

type VariadicSchemaTuple = readonly [SchemaLike, SchemaLike, ...SchemaLike[]];
type RuntimeAndSchema = Schema<unknown>;

const isLegacyInput = (
  input: AndLegacyInput<unknown, unknown> | AndSchemaInput<VariadicSchemaTuple>,
): input is AndLegacyInput<unknown, unknown> => 'left' in input && 'right' in input;

const runtimeAndSchema = (schema: SchemaLike): RuntimeAndSchema =>
  schema as unknown as RuntimeAndSchema;

/**
 * and is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/and
 *
 * @example
 * // Extends a base message input schema with an id field (legacy API).
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
 * // Uses explicit naming for generated type surfaces (legacy API).
 * const MessageWithId = and({
 *   left: messageInput,
 *   right: withId,
 *   name: 'MessageWithId',
 * });
 * MessageWithId.parse({ text: 'Hello', id: 'm-1' });
 *
 * @example
 * // Composes multiple schemas using the schemas array (new API).
 * const MessageWithId = and({
 *   name: 'MessageWithId',
 *   schemas: [messageInput, withId],
 * });
 * MessageWithId.parse({ text: 'Hello', id: 'm-1' });
 *
 * @example
 * // Composes three schemas using the schemas array.
 * const MessageComplete = and({
 *   schemas: [messageInput, withId, withTimestamp],
 * });
 * MessageComplete.parse({ text: 'Hello', id: 'm-1', timestamp: Date.now() });
 */
export function and<TSchemas extends VariadicSchemaTuple>(
  input: AndSchemaInput<TSchemas>,
): Schema<IntersectTuple<InferSchemasTuple<TSchemas>>>;
export function and<T, U>(input: AndLegacyInput<T, U>): Schema<T & U>;
export function and(
  input: AndLegacyInput<unknown, unknown> | AndSchemaInput<VariadicSchemaTuple>,
): Schema<unknown> {
  if (isLegacyInput(input)) {
    const { left, right, name } = input;
    return name === undefined ? left.and(right) : left.and(right, { name });
  }

  const { schemas, name } = input;

  if (schemas.length < 2) {
    throw new Error('and() requires at least 2 schemas in the schemas array');
  }

  const [first, ...rest] = schemas;
  const initial = runtimeAndSchema(first);
  const lastIndex = rest.length - 1;
  const reduced = rest.reduce<AndReduceState>(
    (state, schema) => ({
      schema:
        name !== undefined && state.index === lastIndex
          ? state.schema.and(runtimeAndSchema(schema), { name })
          : state.schema.and(runtimeAndSchema(schema)),
      index: state.index + 1,
    }),
    { schema: initial, index: 0 },
  );

  return reduced.schema;
}
