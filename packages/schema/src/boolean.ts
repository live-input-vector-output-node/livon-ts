import { schemaFactory } from './schemaFactory.js';
import { isBoolean } from './typeGuards.js';
import type { SchemaDoc } from './types.js';

export interface BooleanFactoryInput {
  name?: string;
  doc?: SchemaDoc;
}

/**
 * boolean is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/boolean
 *
 * @example
 * const result = boolean(undefined as never);
 */
export const boolean = ({ name = 'boolean', doc }: BooleanFactoryInput = {}) =>
  schemaFactory<boolean>({
    name,
    type: 'boolean',
    doc,
    ast: () => ({ type: 'boolean', name }),
    validate: (input) => {
      if (!isBoolean(input)) {
        throw { message: 'Data is not a boolean', code: 'boolean.type' };
      }
      return input;
    },
  });
