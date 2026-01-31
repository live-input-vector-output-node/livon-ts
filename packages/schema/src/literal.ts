import { schemaFactory } from './schemaFactory.js';
import { SchemaDoc } from './types.js';

export interface LiteralSchemaInput<T extends string | number | boolean> {
  name: string;
  value: T;
  doc?: SchemaDoc;
}

/**
 * literal is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/literal
 *
 * @example
 * const result = literal(undefined as never);
 */
export const literal = <const T extends string | number | boolean>({
  name,
  value,
  doc,
}: LiteralSchemaInput<T>) =>
  schemaFactory({
    name,
    type: `literal<${String(value)}>`,
    doc,
    ast: () => ({ type: 'literal', name, constraints: { value } }),
    validate: (input) => {
      if (input !== value) {
        throw { message: `Expected ${String(value)}`, code: 'literal.value' };
      }
      return value;
    },
  });
