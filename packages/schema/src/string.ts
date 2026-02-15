import { schemaFactory, SchemaFactoryChainDefinition } from './schemaFactory.js';
import { isString } from './typeGuards.js';
import { SchemaContext, SchemaDoc } from './types.js';

export interface StringFactoryInput {
  name?: string;
  doc?: SchemaDoc;
}

/**
 * Chain operation: validates minimum length.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 *
 * @example
 * // Enforces at least 3 characters for a string value.
 * string().min(3)
 */
export interface StringChainMin {
  (data: string, ctx: SchemaContext): (min: number) => string;
}

/**
 * Chain operation: validates maximum length.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 *
 * @example
 * // Enforces at most 120 characters for a string value.
 * string().max(120)
 */
export interface StringChainMax {
  (data: string, ctx: SchemaContext): (max: number) => string;
}

/**
 * Chain operation: validates e-mail format.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 *
 * @example
 * // Validates that the string matches a basic e-mail pattern.
 * string().email()
 */
export interface StringChainEmail {
  (data: string, ctx: SchemaContext): () => string;
}

/**
 * Chain operation: validates a custom regular expression.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 *
 * @example
 * // Validates the string against a custom regular expression.
 * string().regex(/^[a-z]+$/i)
 */
export interface StringChainRegex {
  (data: string, ctx: SchemaContext): (pattern: RegExp) => string;
}

/**
 * Chain map for `string()` schemas.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 */
export interface StringChainDefinition extends SchemaFactoryChainDefinition<string> {
  min: StringChainMin;
  max: StringChainMax;
  email: StringChainEmail;
  regex: StringChainRegex;
}

export type StringSchema = ReturnType<typeof string>;

/**
 * string is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/string
 *
 * @example
 * // Creates a basic string schema and validates a username.
 * const Username = string();
 * Username.parse('alice');
 *
 * @example
 * // Adds chain rules to enforce a username length range.
 * const Username = string().min(3).max(20);
 * Username.parse('alice');
 */
export const string = ({ name = 'string', doc }: StringFactoryInput = {}) =>
  schemaFactory<string, StringChainDefinition>({
    name,
    type: 'string',
    doc,
    ast: () => ({ type: 'string', name }),
    validate: (input) => {
      if (!isString(input)) {
        throw { message: 'Data is not a string', code: 'string.type' };
      }
      return input;
    },
    chain: {
      min: (data: string, _ctx: SchemaContext) => (min: number) => {
        if (data.length < min) {
          throw { message: 'String is too short', code: 'string.min', context: { min } };
        }
        return data;
      },
      max: (data: string, _ctx: SchemaContext) => (max: number) => {
        if (data.length > max) {
          throw { message: 'String is too long', code: 'string.max', context: { max } };
        }
        return data;
      },
      email: (data: string, _ctx: SchemaContext) => () => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(data)) {
          throw { message: 'Invalid email format', code: 'string.email' };
        }
        return data;
      },
      regex: (data: string, _ctx: SchemaContext) => (pattern: RegExp) => {
        if (!pattern.test(data)) {
          throw { message: 'String does not match pattern', code: 'string.regex', context: { pattern: pattern.source } };
        }
        return data;
      },
    },
  });
