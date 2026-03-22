import { pack } from 'msgpackr';
import { encodeBase64 } from './base64.js';

export const serializeKey = (input: unknown): string => {
  try {
    const packed = pack(input);
    return encodeBase64(packed);
  } catch {
    throw new TypeError(
      'Cannot serialize key input with msgpackr. Scope and payload must be msgpack-serializable.',
    );
  }
};
