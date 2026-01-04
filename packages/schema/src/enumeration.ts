import { schemaFactory, SchemaFactoryChainDefinition, SchemaWithChain } from './schemaFactory.js';
import type { SchemaDoc } from './types.js';

export type EnumValues = readonly [string | number, ...(string | number)[]];

/**
 * Chain operation: enforces one exact enum literal.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/enumeration
 *
 * @example
 * enumeration('Role').values('admin', 'user').literal('admin')
 */
export interface EnumLiteralChain<TValue extends string | number> {
  (data: TValue): (only: TValue) => TValue;
}

/**
 * Chain map for enum schemas.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/enumeration
 */
export interface EnumChainDefinition<TValue extends string | number>
  extends SchemaFactoryChainDefinition<TValue> {
  literal: EnumLiteralChain<TValue>;
}

/**
 * Factory returned by `enumeration(...)`.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/enumeration
 */
export interface EnumFactory {
  values: <TValues extends EnumValues>(
    ...values: TValues
  ) => SchemaWithChain<TValues[number], EnumChainDefinition<TValues[number]>>;
}

/**
 * enumeration is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/enumeration
 *
 * @example
 * const result = enumeration(undefined as never);
 */
export const enumeration = (name: string, doc?: SchemaDoc): EnumFactory => ({
  values: <TValues extends EnumValues>(...values: TValues) =>
    schemaFactory<TValues[number], EnumChainDefinition<TValues[number]>>({
      name: `enum:${name}`,
      type: 'enum',
      doc,
      ast: () => ({ type: 'enum', name, constraints: { values } }),
      validate: (input) => {
        if (!values.includes(input as TValues[number])) {
          throw {
            message: `Input "${String(input)}" is not valid for enum "${name}". Valid values: ${values.join(', ')}`,
            code: 'enum.value',
            context: { name, values },
          };
        }
        return input as TValues[number];
      },
      chain: {
        literal: (data: TValues[number]) => (only: TValues[number]) => {
          if (data !== only) {
            throw {
              message: `Input "${String(data)}" does not match literal "${String(only)}" for enum "${name}".`,
              code: 'enum.literal',
              context: { name, only },
            };
          }
          return data;
        },
      },
    }),
});
