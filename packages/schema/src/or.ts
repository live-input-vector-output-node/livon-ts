import { schemaFactory } from './schemaFactory.js';
import { resolveCombinatorName } from './combinatorName.js';
import { Infer, SchemaContext, SchemaDoc, SchemaLike } from './types.js';

type AnySchema = SchemaLike;

export interface OrSchemaDiscriminator<TValues extends readonly AnySchema[]> {
  (input: unknown, ctx: SchemaContext): TValues[number] | undefined;
}

export interface OrSchemaInput<TValues extends readonly AnySchema[]> {
  name?: string;
  options: TValues;
  discriminator?: OrSchemaDiscriminator<TValues>;
  doc?: SchemaDoc;
}

interface ResolveOrMatchInput<TValues extends readonly AnySchema[]> {
  input: unknown;
  ctx: SchemaContext;
  options: TValues;
  discriminator?: OrSchemaDiscriminator<TValues>;
}

const resolveOrMatch = <TValues extends readonly AnySchema[]>({
  input,
  ctx,
  options,
  discriminator,
}: ResolveOrMatchInput<TValues>): Infer<TValues[number]> => {
  if (discriminator) {
    const selected = discriminator(input, ctx);
    if (selected) {
      if (!options.includes(selected)) {
        throw { message: 'Discriminator selected an unknown schema option.', code: 'or.discriminator' };
      }
      return selected.parse(input, ctx) as Infer<TValues[number]>;
    }
  }

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

  return matches.value as Infer<TValues[number]>;
};

/**
 * or is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/or
 *
 * @example
 * // Creates an or-schema that accepts either string or number identifiers.
 * const Identifier = or({
 *   options: [string(), number()] as const,
 * });
 * Identifier.parse('user-1');
 *
 * @example
 * // Extends the or-schema to also allow undefined.
 * const OptionalIdentifier = or({
 *   name: 'identifier',
 *   options: [string(), number()] as const,
 * }).optional();
 * OptionalIdentifier.parse(undefined);
 */
export const or = <TValues extends readonly AnySchema[]>({
  name,
  options,
  discriminator,
  doc,
}: OrSchemaInput<TValues>) => {
  const schemaName = resolveCombinatorName({
    fallback: 'Or',
    name,
    options,
  });

  return schemaFactory({
    name: schemaName,
    type: 'or',
    doc,
    ast: (ctx) => {
      const build = ctx.getBuildContext();
      return { type: 'union', name: schemaName, children: options.map((option) => option.ast(build ?? undefined)) };
    },
    validate: (input, ctx) => resolveOrMatch({ input, ctx, options, discriminator }),
  });
};
