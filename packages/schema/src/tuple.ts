import { schemaFactory } from './schemaFactory.js';
import { isArray } from './typeGuards.js';
import { Schema, SchemaDoc } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tuple items can contain heterogeneous schema output types.
type AnySchema = Schema<any>;

export interface TupleSchemaInput<TItems extends readonly AnySchema[]> {
  name: string;
  items: TItems;
  doc?: SchemaDoc;
}

/**
 * tuple is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/tuple
 *
 * @example
 * const result = tuple(undefined as never);
 */
export const tuple = <TItems extends readonly AnySchema[]>({
  name,
  items,
  doc,
}: TupleSchemaInput<TItems>) =>
  schemaFactory({
    name,
    type: 'tuple',
    doc,
    ast: (ctx) => {
      const build = ctx.getBuildContext();
      return { type: 'tuple', name, children: items.map((item) => item.ast(build ?? undefined)) };
    },
    validate: (input, ctx) => {
      if (!isArray<unknown>()(input)) {
        throw { message: 'Expected tuple', code: 'tuple.type' };
      }
      const result = items.map((schema, index) => schema.parse(input[index], ctx)) as {
        [K in keyof TItems]: ReturnType<TItems[K]['parse']>;
      };
      return result;
    },
  });
