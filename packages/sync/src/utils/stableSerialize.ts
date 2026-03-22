interface RecordValue {
  [key: string]: unknown;
}

const isRecord = (input: unknown): input is RecordValue => {
  return typeof input === 'object' && input !== null && !Array.isArray(input);
};

export const stableSerialize = (input: unknown): string => {
  if (input === undefined) {
    return 'undefined';
  }

  if (input === null) {
    return 'null';
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return JSON.stringify(input);
  }

  if (typeof input === 'string') {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  if (isRecord(input)) {
    const serializedEntries = Object.keys(input)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(input[key])}`);

    return `{${serializedEntries.join(',')}}`;
  }

  return JSON.stringify(String(input));
};
