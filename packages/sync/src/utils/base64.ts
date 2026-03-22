type Base64Encode = (input: Uint8Array) => string;
type Base64Decode = (input: string) => Uint8Array;

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

const readBtoa = (): ((input: string) => string) | null => {
  const maybeBtoa = Reflect.get(globalThis, 'btoa');
  if (typeof maybeBtoa !== 'function') {
    return null;
  }

  return (input: string) => {
    const result = Reflect.apply(maybeBtoa, globalThis, [input]);
    if (typeof result !== 'string') {
      throw new Error('base64 encoder returned non-string output.');
    }

    return result;
  };
};

const readAtob = (): ((input: string) => string) | null => {
  const maybeAtob = Reflect.get(globalThis, 'atob');
  if (typeof maybeAtob !== 'function') {
    return null;
  }

  return (input: string) => {
    const result = Reflect.apply(maybeAtob, globalThis, [input]);
    if (typeof result !== 'string') {
      throw new Error('base64 decoder returned non-string output.');
    }

    return result;
  };
};

const resolveBase64Encode = (): Base64Encode => {
  const bufferLike = readBufferLike();
  if (bufferLike) {
    return (input) => {
      const encoded = bufferLike.from(input);
      if (
        encoded === null
        || (typeof encoded !== 'object' && typeof encoded !== 'function')
      ) {
        throw new Error('Buffer.from did not return an object for base64 encoding.');
      }

      const maybeToString = Reflect.get(encoded, 'toString');
      if (typeof maybeToString !== 'function') {
        throw new Error('Buffer.from result has no toString function for base64 encoding.');
      }

      const result = Reflect.apply(maybeToString, encoded, ['base64']);
      if (typeof result !== 'string') {
        throw new Error('Buffer base64 encoding returned non-string output.');
      }

      return result;
    };
  }

  const btoaValue = readBtoa();
  if (btoaValue) {
    return (input) => {
      const binary = Array.from(input, (entry) => String.fromCharCode(entry)).join('');
      return btoaValue(binary);
    };
  }

  return () => {
    throw new Error('No base64 encoder available on runtime.');
  };
};

const resolveBase64Decode = (): Base64Decode => {
  const bufferLike = readBufferLike();
  if (bufferLike) {
    return (input) => {
      const decoded = bufferLike.from(input, 'base64');
      if (decoded instanceof Uint8Array) {
        return Uint8Array.from(decoded);
      }

      throw new Error('Buffer.from(base64) did not return Uint8Array-compatible data.');
    };
  }

  const atobValue = readAtob();
  if (atobValue) {
    return (input) => {
      const binary = atobValue(input);
      return Uint8Array.from(binary, (char) => char.charCodeAt(0));
    };
  }

  return () => {
    throw new Error('No base64 decoder available on runtime.');
  };
};

export const encodeBase64 = resolveBase64Encode();
export const decodeBase64 = resolveBase64Decode();
