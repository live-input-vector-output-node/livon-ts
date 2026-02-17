import { schemaFactory } from './schemaFactory.js';
import { isArray } from './typeGuards.js';
import { Schema, SchemaDoc } from './types.js';

export interface ArraySchemaInput<T> {
  name: string;
  item: Schema<T>;
  doc?: SchemaDoc;
}

/**
 * array is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/array
 *
 * @example
 * // Creates an array schema that validates string items.
 * const Tags = array({ name: 'tags', item: string() });
 * Tags.parse(['typescript', 'schema']);
 *
 * @example
 * // Extends the array schema to also allow undefined.
 * const OptionalTags = array({ name: 'tags', item: string() }).optional();
 * OptionalTags.parse(undefined);
 */
export const array = <T>({ name, item, doc }: ArraySchemaInput<T>) =>
  schemaFactory({
    name,
    type: `array<${item.name}>`,
    doc,
    ast: (ctx) => {
      const build = ctx.getBuildContext();
      return { type: 'array', name, children: [item.ast(build ?? undefined)] };
    },
    validate: (input, ctx) => {
      if (!isArray<T>()(input)) {
        throw { message: 'Expected array', code: 'array.type' };
      }
      const values: T[] = [];
      input.forEach((value, index) => {
        try {
          values.push(item.parse(value, ctx));
        } catch (error) {
          throw { message: `Invalid item at index ${index}`, code: 'array.item', context: { index, error } };
        }
      });
      return values;
    },
  });
