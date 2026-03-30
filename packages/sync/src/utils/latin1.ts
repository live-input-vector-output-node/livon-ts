type Latin1Encode = (input: Uint8Array) => string;
type Latin1Decode = (input: string) => Uint8Array;

interface GlobalBufferLike {
  from: (...args: readonly unknown[]) => unknown;
}

const readBufferLike = (): GlobalBufferLike | null => {
  const maybeBuffer = Reflect.get(globalThis, 'Buffer');
  if (
    maybeBuffer === null
    || (typeof maybeBuffer !== 'object' && typeof maybeBuffer !== 'function')
  ) {
    return null;
  }

  const maybeFrom = Reflect.get(maybeBuffer, 'from');
  if (typeof maybeFrom !== 'function') {
    return null;
  }

  const from = (...args: readonly unknown[]) => {
    return Reflect.apply(maybeFrom, maybeBuffer, args);
  };

  return {
    from,
  };
};

const resolveLatin1Encode = (): Latin1Encode => {
  const bufferLike = readBufferLike();
  if (bufferLike) {
    return (input) => {
      const encoded = bufferLike.from(input);
      if (
        encoded === null
        || (typeof encoded !== 'object' && typeof encoded !== 'function')
      ) {
        throw new Error('Buffer.from did not return an object for latin1 encoding.');
      }

      const maybeToString = Reflect.get(encoded, 'toString');
      if (typeof maybeToString !== 'function') {
        throw new Error('Buffer.from result has no toString function for latin1 encoding.');
      }

      const result = Reflect.apply(maybeToString, encoded, ['latin1']);
      if (typeof result !== 'string') {
        throw new Error('Buffer latin1 encoding returned non-string output.');
      }

      return result;
    };
  }

  return (input) => {
    return Array.from(input, (entry) => String.fromCharCode(entry)).join('');
  };
};

const resolveLatin1Decode = (): Latin1Decode => {
  const bufferLike = readBufferLike();
  if (bufferLike) {
    return (input) => {
      const decoded = bufferLike.from(input, 'latin1');
      if (decoded instanceof Uint8Array) {
        return Uint8Array.from(decoded);
      }

      throw new Error('Buffer.from(latin1) did not return Uint8Array-compatible data.');
    };
  }

  return (input) => {
    return Uint8Array.from(input, (char) => char.charCodeAt(0) & 0xff);
  };
};

export const encodeLatin1 = resolveLatin1Encode();
export const decodeLatin1 = resolveLatin1Decode();
