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
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/binary
 *
 * @example
 * // Creates a binary schema and validates a Uint8Array payload.
 * const Payload = binary({ name: 'payload' });
 * Payload.parse(new Uint8Array([1, 2, 3]));
 *
 * @example
 * // Extends binary validation to also allow undefined.
 * const MaybePayload = binary({ name: 'payload' }).optional();
 * MaybePayload.parse(undefined);
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
