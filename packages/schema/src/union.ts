import { schemaFactory } from './schemaFactory.js';
import { resolveCombinatorName } from './combinatorName.js';
import { Schema, SchemaContext, SchemaDoc } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- union options intentionally allow heterogeneous schema outputs.
type AnySchema = Schema<any>;

export interface UnionSchemaInput<TValues extends readonly AnySchema[]> {
  name?: string;
  options: TValues;
  doc?: SchemaDoc;
}

interface ResolveUnionMatchInput<TValues extends readonly AnySchema[]> {
  input: unknown;
  ctx: SchemaContext;
  options: TValues;
}

const resolveUnionMatch = <TValues extends readonly AnySchema[]>({
  input,
  ctx,
  options,
}: ResolveUnionMatchInput<TValues>): ReturnType<TValues[number]['parse']> => {
  const matches = options
    .map((option) => {
      try {
        return { ok: true, value: option.parse(input, ctx) } as const;
      } catch (error) {
        return { ok: false, error } as const;
      }
    })
    .find((result) => result.ok);

  if (!matches) {
    throw { message: 'No union match', code: 'union.match' };
  }

  return matches.value as ReturnType<TValues[number]['parse']>;
};

/**
 * union is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/union
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
export const union = <TValues extends readonly AnySchema[]>({
  name,
  options,
  doc,
}: UnionSchemaInput<TValues>) => {
  const schemaName = resolveCombinatorName({
    fallback: 'Union',
    name,
    options,
  });

  return schemaFactory({
    name: schemaName,
    type: 'union',
    doc,
    ast: (ctx) => {
      const build = ctx.getBuildContext();
      return { type: 'union', name: schemaName, children: options.map((option) => option.ast(build ?? undefined)) };
    },
    validate: (input, ctx) => resolveUnionMatch({ input, ctx, options }),
  });
};
