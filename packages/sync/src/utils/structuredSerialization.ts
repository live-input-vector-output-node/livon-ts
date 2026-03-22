interface UnknownRecord {
  [key: string]: unknown;
}

interface SerializedRecord {
  [key: string]: SerializedValue;
}

interface SerializedArray extends Array<SerializedValue> {}

interface SerializedMapEntry {
  key: SerializedValue;
  value: SerializedValue;
}

interface SerializedBaseMarker {
  __livonSerializedValue__: 1;
  __livonType__: string;
}

interface SerializedUndefined extends SerializedBaseMarker {
  __livonType__: 'undefined';
}

interface SerializedSpecialNumber extends SerializedBaseMarker {
  __livonType__: 'number';
  value: 'NaN' | 'Infinity' | '-Infinity' | '-0';
}

interface SerializedBigInt extends SerializedBaseMarker {
  __livonType__: 'bigint';
  value: string;
}

interface SerializedDate extends SerializedBaseMarker {
  __livonType__: 'date';
  value: string;
}

interface SerializedRegExp extends SerializedBaseMarker {
  __livonType__: 'regexp';
  source: string;
  flags: string;
}

interface SerializedMap extends SerializedBaseMarker {
  __livonType__: 'map';
  entries: readonly SerializedMapEntry[];
}

interface SerializedSet extends SerializedBaseMarker {
  __livonType__: 'set';
  values: readonly SerializedValue[];
}

interface SerializedEscapedObject extends SerializedBaseMarker {
  __livonType__: 'escaped-object';
  value: SerializedRecord;
}

interface SerializedStringifiedValue extends SerializedBaseMarker {
  __livonType__: 'stringified';
  sourceType: 'function' | 'symbol' | 'unsupported-object';
  value: string;
}

type SerializedPrimitive = null | boolean | number | string;

type SerializedMarker =
  | SerializedBigInt
  | SerializedDate
  | SerializedEscapedObject
  | SerializedMap
  | SerializedRegExp
  | SerializedSet
  | SerializedSpecialNumber
  | SerializedStringifiedValue
  | SerializedUndefined;

type SerializedValue = SerializedPrimitive | SerializedArray | SerializedMarker | SerializedRecord;

type UnsupportedValueBehavior = 'stringify' | 'throw';

interface BuildSerializedValueInput {
  input: unknown;
  unsupportedValueBehavior: UnsupportedValueBehavior;
  sortCollections: boolean;
  parents: WeakSet<object>;
}

interface BuildSerializedObjectInput extends BuildSerializedValueInput {
  input: object;
}

interface SerializeStructuredValueInput {
  input: unknown;
  unsupportedValueBehavior?: UnsupportedValueBehavior;
}

interface WithParentTrackingInput<TResult> {
  input: object;
  parents: WeakSet<object>;
  run: () => TResult;
}

interface SerializeUnsupportedValueInput {
  input: unknown;
  unsupportedValueBehavior: UnsupportedValueBehavior;
  sourceType: SerializedStringifiedValue['sourceType'];
}

const SERIALIZED_VALUE_MARKER = 1;

const createMarker = <TMarker extends SerializedMarker>(input: Omit<TMarker, '__livonSerializedValue__'>): TMarker => {
  return {
    __livonSerializedValue__: SERIALIZED_VALUE_MARKER,
    ...input,
  } as TMarker;
};

const isSerializedMarker = (input: SerializedValue): input is SerializedMarker => {
  return typeof input === 'object'
    && input !== null
    && !Array.isArray(input)
    && '__livonSerializedValue__' in input
    && input.__livonSerializedValue__ === SERIALIZED_VALUE_MARKER
    && '__livonType__' in input
    && typeof input.__livonType__ === 'string';
};

const isPlainObject = (input: object): boolean => {
  const prototype = Object.getPrototypeOf(input);

  return prototype === Object.prototype || prototype === null;
};

const withParentTracking = <TResult>(
  { input, parents, run }: WithParentTrackingInput<TResult>,
): TResult => {
  if (parents.has(input)) {
    throw new TypeError('Cannot serialize circular structures in @livon/sync.');
  }

  parents.add(input);

  try {
    return run();
  } finally {
    parents.delete(input);
  }
};

const serializeUnsupportedValue = (
  { input, unsupportedValueBehavior, sourceType }: SerializeUnsupportedValueInput,
): SerializedValue => {
  if (unsupportedValueBehavior === 'throw') {
    throw new TypeError(`Cannot serialize ${sourceType} values in @livon/sync.`);
  }

  return createMarker<SerializedStringifiedValue>({
    __livonType__: 'stringified',
    sourceType,
    value: String(input),
  });
};

const stableStringifySerializedValue = (input: SerializedValue): string => {
  if (
    input === null
    || typeof input === 'boolean'
    || typeof input === 'number'
    || typeof input === 'string'
  ) {
    return JSON.stringify(input);
  }

  if (Array.isArray(input)) {
    return `[${input.map((entry) => stableStringifySerializedValue(entry)).join(',')}]`;
  }

  const recordInput = input as SerializedRecord;
  const keys = Object.keys(recordInput).sort();
  const serializedEntries = keys
    .map((key) => {
      const value = recordInput[key] as SerializedValue;

      return `${JSON.stringify(key)}:${stableStringifySerializedValue(value)}`;
    });

  return `{${serializedEntries.join(',')}}`;
};

const decodeSerializedRecord = (input: SerializedRecord): UnknownRecord => {
  const decodedRecord: UnknownRecord = {};

  Object.keys(input).forEach((key) => {
    decodedRecord[key] = decodeSerializedValue(input[key] as SerializedValue);
  });

  return decodedRecord;
};

const buildSerializedObject = ({
  input,
  unsupportedValueBehavior,
  sortCollections,
  parents,
}: BuildSerializedObjectInput): SerializedValue => {
  if (input instanceof Date) {
    return createMarker<SerializedDate>({
      __livonType__: 'date',
      value: String(input.getTime()),
    });
  }

  if (input instanceof RegExp) {
    return createMarker<SerializedRegExp>({
      __livonType__: 'regexp',
      source: input.source,
      flags: input.flags,
    });
  }

  if (input instanceof Map) {
    return withParentTracking({
      input,
      parents,
      run: () => {
      const entries = Array.from(input.entries()).map(([key, value]) => {
        return {
          key: buildSerializedValue({
            input: key,
            unsupportedValueBehavior,
            sortCollections,
            parents,
          }),
          value: buildSerializedValue({
            input: value,
            unsupportedValueBehavior,
            sortCollections,
            parents,
          }),
        } satisfies SerializedMapEntry;
      });

      const normalizedEntries = sortCollections
        ? [...entries].sort((left, right) => {
            const leftKey = stableStringifySerializedValue(left.key);
            const rightKey = stableStringifySerializedValue(right.key);
            if (leftKey !== rightKey) {
              return leftKey.localeCompare(rightKey);
            }

            const leftValue = stableStringifySerializedValue(left.value);
            const rightValue = stableStringifySerializedValue(right.value);

            return leftValue.localeCompare(rightValue);
          })
        : entries;

      return createMarker<SerializedMap>({
        __livonType__: 'map',
        entries: normalizedEntries,
      });
      },
    });
  }

  if (input instanceof Set) {
    return withParentTracking({
      input,
      parents,
      run: () => {
      const values = Array.from(input.values()).map((value) => {
        return buildSerializedValue({
          input: value,
          unsupportedValueBehavior,
          sortCollections,
          parents,
        });
      });

      const normalizedValues = sortCollections
        ? [...values].sort((left, right) => {
            return stableStringifySerializedValue(left)
              .localeCompare(stableStringifySerializedValue(right));
          })
        : values;

      return createMarker<SerializedSet>({
        __livonType__: 'set',
        values: normalizedValues,
      });
      },
    });
  }

  const objectKeysBase = Object.keys(input as UnknownRecord);
  const objectKeys = sortCollections
    ? [...objectKeysBase].sort()
    : objectKeysBase;
  if (objectKeys.length === 0 && !isPlainObject(input)) {
    return serializeUnsupportedValue({
      input,
      unsupportedValueBehavior,
      sourceType: 'unsupported-object',
    });
  }

  return withParentTracking({
    input,
    parents,
    run: () => {
    const serializedRecord: SerializedRecord = {};

    objectKeys.forEach((key) => {
      serializedRecord[key] = buildSerializedValue({
        input: (input as UnknownRecord)[key],
        unsupportedValueBehavior,
        sortCollections,
        parents,
      });
    });

    if (isSerializedMarker(serializedRecord)) {
      return createMarker<SerializedEscapedObject>({
        __livonType__: 'escaped-object',
        value: serializedRecord,
      });
    }

    return serializedRecord;
    },
  });
};

const buildSerializedValue = ({
  input,
  unsupportedValueBehavior,
  sortCollections,
  parents,
}: BuildSerializedValueInput): SerializedValue => {
  if (input === null) {
    return null;
  }

  if (input === undefined) {
    return createMarker<SerializedUndefined>({
      __livonType__: 'undefined',
    });
  }

  if (typeof input === 'string' || typeof input === 'boolean') {
    return input;
  }

  if (typeof input === 'number') {
    if (Number.isNaN(input)) {
      return createMarker<SerializedSpecialNumber>({
        __livonType__: 'number',
        value: 'NaN',
      });
    }

    if (input === Number.POSITIVE_INFINITY) {
      return createMarker<SerializedSpecialNumber>({
        __livonType__: 'number',
        value: 'Infinity',
      });
    }

    if (input === Number.NEGATIVE_INFINITY) {
      return createMarker<SerializedSpecialNumber>({
        __livonType__: 'number',
        value: '-Infinity',
      });
    }

    if (Object.is(input, -0)) {
      return createMarker<SerializedSpecialNumber>({
        __livonType__: 'number',
        value: '-0',
      });
    }

    return input;
  }

  if (typeof input === 'bigint') {
    return createMarker<SerializedBigInt>({
      __livonType__: 'bigint',
      value: input.toString(),
    });
  }

  if (typeof input === 'symbol') {
    return serializeUnsupportedValue({
      input,
      unsupportedValueBehavior,
      sourceType: 'symbol',
    });
  }

  if (typeof input === 'function') {
    return serializeUnsupportedValue({
      input,
      unsupportedValueBehavior,
      sourceType: 'function',
    });
  }

  if (Array.isArray(input)) {
    return withParentTracking({
      input,
      parents,
      run: () => {
        return input.map((entry) => {
          return buildSerializedValue({
            input: entry,
            unsupportedValueBehavior,
            sortCollections,
            parents,
          });
        });
      },
    });
  }

  return buildSerializedObject({
    input,
    unsupportedValueBehavior,
    sortCollections,
    parents,
  });
};

const decodeSerializedValue = (input: SerializedValue): unknown => {
  if (
    input === null
    || typeof input === 'boolean'
    || typeof input === 'number'
    || typeof input === 'string'
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((entry) => decodeSerializedValue(entry));
  }

  if (!isSerializedMarker(input)) {
    return decodeSerializedRecord(input);
  }

  switch (input.__livonType__) {
    case 'undefined':
      return undefined;
    case 'number':
      if (input.value === 'NaN') {
        return Number.NaN;
      }

      if (input.value === 'Infinity') {
        return Number.POSITIVE_INFINITY;
      }

      if (input.value === '-Infinity') {
        return Number.NEGATIVE_INFINITY;
      }

      return -0;
    case 'bigint':
      return BigInt(input.value);
    case 'date':
      return new Date(Number(input.value));
    case 'regexp':
      return new RegExp(input.source, input.flags);
    case 'map':
      return new Map(
        input.entries.map((entry) => {
          return [decodeSerializedValue(entry.key), decodeSerializedValue(entry.value)] as const;
        }),
      );
    case 'set':
      return new Set(
        input.values.map((value) => {
          return decodeSerializedValue(value);
        }),
      );
    case 'escaped-object':
      return decodeSerializedValue(input.value);
    case 'stringified':
      return input.value;
    default:
      return decodeSerializedRecord(input);
  }
};

export const serializeStructuredValue = ({
  input,
  unsupportedValueBehavior = 'throw',
}: SerializeStructuredValueInput): string => {
  const serializedValue = buildSerializedValue({
    input,
    unsupportedValueBehavior,
    sortCollections: false,
    parents: new WeakSet<object>(),
  });

  return JSON.stringify(serializedValue);
};

export const deserializeStructuredValue = <TResult>(input: string): TResult => {
  const parsed = JSON.parse(input) as SerializedValue;

  return decodeSerializedValue(parsed) as TResult;
};

const createStableSerializedValue = (input: unknown): SerializedValue => {
  return buildSerializedValue({
    input,
    unsupportedValueBehavior: 'stringify',
    sortCollections: true,
    parents: new WeakSet<object>(),
  });
};

export const createStableStructuredValue = (input: unknown): unknown => {
  return createStableSerializedValue(input);
};

export const stableSerializeStructuredValue = (input: unknown): string => {
  const serializedValue = createStableSerializedValue(input);

  return stableStringifySerializedValue(serializedValue);
};
