import { pack } from 'msgpackr';
import { encodeLatin1 } from './latin1.js';

export const serializeKey = (input: unknown): string => {
  try {
    const packed = pack(input);
    return encodeLatin1(packed);
  } catch {
    throw new TypeError(
      'Cannot serialize key input with msgpackr. Scope and payload must be msgpack-serializable.',
    );
  }
};
