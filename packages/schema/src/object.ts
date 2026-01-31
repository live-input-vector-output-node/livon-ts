import { schemaFactory, SchemaWithChain } from './schemaFactory.js';
import { isRecord } from './typeGuards.js';
import { Schema, Shape, SchemaDoc } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- object shape must accept arbitrary schema output types per key.
type AnySchema = Schema<any>;

export interface ObjectSchemaInput<TShape extends Shape> {
  name: string;
  shape: TShape;
  doc?: SchemaDoc;
}

/**
 * object is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/object
 *
 * @example
 * const result = object(undefined as never);
 */
export const object = <
  TShape extends Record<string, AnySchema>
>({
  name,
  shape,
  doc,
}: ObjectSchemaInput<TShape>): SchemaWithChain<{ [K in keyof TShape]: ReturnType<TShape[K]['parse']> }, {}> =>
  schemaFactory({
    name,
    type: 'object',
    doc,
    ast: (ctx) => {
      const build = ctx.getBuildContext();
      return {
        type: 'object',
        name,
        children: Object.entries(shape).map(([key, schema]) => ({
          type: 'field',
          name: key,
          children: [schema.ast(build ?? undefined)],
        })),
      };
    },
    validate: (input, ctx) => {
      if (!isRecord(input)) {
        throw { message: 'Expected object', code: 'object.type' };
      }
      return Object.entries(shape).reduce((acc, [key, schema]) => {
        return { ...acc, [key]: (schema as AnySchema).parse(input[key], ctx) };
      }, {} as { [K in keyof TShape]: ReturnType<TShape[K]['parse']> });
    },
  });
