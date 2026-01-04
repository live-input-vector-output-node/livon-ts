import { schemaFactory } from './schemaFactory.js';
import { isNumber } from './typeGuards.js';
import { SchemaContext, SchemaDoc } from './types.js';

export interface NumberFactoryInput {
  name?: string;
  doc?: SchemaDoc;
}

/**
 * Chain operation: validates minimum numeric value.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 *
 * @example
 * number().min(0)
 */
export interface NumberChainMin {
  (data: number, ctx: SchemaContext): (min: number) => number;
}

/**
 * Chain operation: validates maximum numeric value.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 *
 * @example
 * number().max(100)
 */
export interface NumberChainMax {
  (data: number, ctx: SchemaContext): (max: number) => number;
}

/**
 * Chain operation: validates integer-only numbers.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 *
 * @example
 * number().int()
 */
export interface NumberChainInt {
  (data: number, ctx: SchemaContext): () => number;
}

/**
 * Chain operation: validates positive numbers.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 *
 * @example
 * number().positive()
 */
export interface NumberChainPositive {
  (data: number, ctx: SchemaContext): () => number;
}

/**
 * Chain map for `number()` schemas.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 */
export interface NumberChainDefinition {
  min: NumberChainMin;
  max: NumberChainMax;
  int: NumberChainInt;
  positive: NumberChainPositive;
}

export type NumberSchema = ReturnType<typeof number>;

/**
 * number is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/number
 *
 * @example
 * const result = number(undefined as never);
 */
export const number = ({ name = 'number', doc }: NumberFactoryInput = {}) =>
  schemaFactory<number>({
    name,
    type: 'number',
    doc,
    ast: () => ({ type: 'number', name }),
    validate: (input) => {
      if (!isNumber(input)) {
        throw { message: 'Data is not a number', code: 'number.type' };
      }
      return input;
    },
    chain: {
      min: (data: number, _ctx: SchemaContext) => (min: number) => {
        if (data < min) {
          throw { message: `Expected number >= ${min}`, code: 'number.min', context: { min } };
        }
        return data;
      },
      max: (data: number, _ctx: SchemaContext) => (max: number) => {
        if (data > max) {
          throw { message: `Expected number <= ${max}`, code: 'number.max', context: { max } };
        }
        return data;
      },
      int: (data: number, _ctx: SchemaContext) => () => {
        if (!Number.isInteger(data)) {
          throw { message: 'Expected integer', code: 'number.int' };
        }
        return data;
      },
      positive: (data: number, _ctx: SchemaContext) => () => {
        if (data <= 0) {
          throw { message: 'Expected positive number', code: 'number.positive' };
        }
        return data;
      },
    },
  });
