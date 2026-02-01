import { schemaFactory } from './schemaFactory.js';
import { isUint8Array } from './typeGuards.js';
import { SchemaDoc } from './types.js';

export interface BinarySchemaInput {
  name: string;
  doc?: SchemaDoc;
}

/**
 * binary is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/binary
 *
 * @example
 * const result = binary(undefined as never);
 */
export const binary = ({ name, doc }: BinarySchemaInput) =>
  schemaFactory<Uint8Array>({
    name,
    type: 'binary',
    doc,
    ast: () => ({ type: 'binary', name }),
    validate: (input) => {
      if (!isUint8Array(input)) {
        throw { message: 'Expected Uint8Array', code: 'binary.type' };
      }
      return input;
    },
  });
