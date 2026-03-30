import { pack, unpack } from 'msgpackr';

const SERIALIZED_VALUE_MARKER = 1;

const createMarker = ({ type, ...rest }) => {
  return {
    __livonSerializedValue__: SERIALIZED_VALUE_MARKER,
    __livonType__: type,
    ...rest,
  };
};

const isRecord = (value) => {
  return typeof value === 'object' && value !== null;
};

const isPlainObject = (value) => {
  if (!isRecord(value) || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const hasMarkerShape = (value) => {
  return isRecord(value)
    && value.__livonSerializedValue__ === SERIALIZED_VALUE_MARKER
    && typeof value.__livonType__ === 'string';
};

const normalizePlainObject = (value) => {
  const sortedEntries = Object.entries(value).sort(([left], [right]) => {
    return left.localeCompare(right);
  });

  const normalized = {};
  sortedEntries.forEach(([key, entryValue]) => {
    normalized[key] = entryValue;
  });

  if (hasMarkerShape(normalized)) {
    return createMarker({
      type: 'escaped-object',
      value: normalized,
    });
  }

  return normalized;
};

const resolveRawReplacerValue = ({ holder, key, value }) => {
  if (key === '') {
    return value;
  }

  if (!isRecord(holder)) {
    return value;
  }

  if (!Object.prototype.hasOwnProperty.call(holder, key)) {
    return value;
  }

  return holder[key];
};

const jsonStructuredReplacer = function (key, value) {
  const rawValue = resolveRawReplacerValue({
    holder: this,
    key,
    value,
  });

  if (rawValue === undefined) {
    return createMarker({
      type: 'undefined',
    });
  }

  if (rawValue === null || typeof rawValue === 'string' || typeof rawValue === 'boolean') {
    return rawValue;
  }

  if (typeof rawValue === 'number') {
    if (Number.isNaN(rawValue)) {
      return createMarker({
        type: 'number',
        value: 'NaN',
      });
    }

    if (rawValue === Number.POSITIVE_INFINITY) {
      return createMarker({
        type: 'number',
        value: 'Infinity',
      });
    }

    if (rawValue === Number.NEGATIVE_INFINITY) {
      return createMarker({
        type: 'number',
        value: '-Infinity',
      });
    }

    if (Object.is(rawValue, -0)) {
      return createMarker({
        type: 'number',
        value: '-0',
      });
    }

    return rawValue;
  }

  if (typeof rawValue === 'bigint') {
    return createMarker({
      type: 'bigint',
      value: rawValue.toString(),
    });
  }

  if (typeof rawValue === 'function') {
    throw new TypeError('Cannot serialize function values in @livon/sync.');
  }

  if (typeof rawValue === 'symbol') {
    throw new TypeError('Cannot serialize symbol values in @livon/sync.');
  }

  if (rawValue instanceof Date) {
    return createMarker({
      type: 'date',
      value: String(rawValue.getTime()),
    });
  }

  if (rawValue instanceof RegExp) {
    return createMarker({
      type: 'regexp',
      source: rawValue.source,
      flags: rawValue.flags,
    });
  }

  if (rawValue instanceof Map) {
    return createMarker({
      type: 'map',
      entries: Array.from(rawValue.entries()).map(([entryKey, entryValue]) => {
        return {
          key: entryKey,
          value: entryValue,
        };
      }),
    });
  }

  if (rawValue instanceof Set) {
    return createMarker({
      type: 'set',
      values: Array.from(rawValue.values()),
    });
  }

  if (Array.isArray(rawValue)) {
    return rawValue;
  }

  if (!isPlainObject(rawValue)) {
    throw new TypeError('Cannot serialize unsupported-object values in @livon/sync.');
  }

  return normalizePlainObject(rawValue);
};

const jsonStructuredReviver = (_key, value) => {
  if (!hasMarkerShape(value)) {
    return value;
  }

  switch (value.__livonType__) {
    case 'undefined':
      return undefined;
    case 'number':
      if (value.value === 'NaN') {
        return Number.NaN;
      }

      if (value.value === 'Infinity') {
        return Number.POSITIVE_INFINITY;
      }

      if (value.value === '-Infinity') {
        return Number.NEGATIVE_INFINITY;
      }

      return -0;
    case 'bigint':
      return BigInt(value.value);
    case 'date':
      return new Date(Number(value.value));
    case 'regexp':
      return new RegExp(value.source, value.flags);
    case 'map':
      return new Map(
        value.entries.map((entry) => {
          return [entry.key, entry.value];
        }),
      );
    case 'set':
      return new Set(value.values);
    case 'escaped-object':
      return value.value;
    default:
      return value;
  }
};

const serializeWithJsonReplacer = (input) => {
  return JSON.stringify(input, jsonStructuredReplacer);
};

const deserializeWithJsonReviver = (input) => {
  return JSON.parse(input, jsonStructuredReviver);
};

const serializeWithMsgpackBase64 = (input) => {
  return Buffer.from(pack(input)).toString('base64');
};

const deserializeWithMsgpackBase64 = (input) => {
  return unpack(Buffer.from(input, 'base64'));
};

const createSetManyPayload = () => {
  return Array.from({ length: 64 }, (_unused, index) => {
    return {
      id: String(100000 + index),
      listId: 'bench-list-100k',
      title: `SetMany #${100000 + index}`,
      completed: index % 2 === 0,
      updatedAt: 100000 + index,
    };
  });
};

const verifyContract = () => {
  const sample = {
    createdAt: new Date('2026-03-26T12:00:00.000Z'),
    invalidDate: new Date(Number.NaN),
    total: 12345678901234567890n,
    emptyValue: undefined,
    notANumber: Number.NaN,
    positiveInfinity: Number.POSITIVE_INFINITY,
    negativeInfinity: Number.NEGATIVE_INFINITY,
    negativeZero: -0,
    matcher: /livon/gi,
    tags: new Set(['sync', 'react']),
    lookup: new Map([
      ['alpha', 1],
      ['beta', 2],
    ]),
    nested: {
      values: [undefined, new Date('2026-03-22T00:00:00.000Z')],
    },
  };

  const serialized = serializeWithJsonReplacer(sample);
  const parsed = deserializeWithJsonReviver(serialized);

  if (!(parsed.createdAt instanceof Date)) {
    throw new Error('Contract check failed: createdAt');
  }

  if (!(parsed.invalidDate instanceof Date) || !Number.isNaN(parsed.invalidDate.getTime())) {
    throw new Error('Contract check failed: invalidDate');
  }

  if (parsed.total !== 12345678901234567890n) {
    throw new Error('Contract check failed: total');
  }

  if (parsed.emptyValue !== undefined) {
    throw new Error('Contract check failed: emptyValue');
  }

  if (!Number.isNaN(parsed.notANumber)) {
    throw new Error('Contract check failed: notANumber');
  }

  if (parsed.positiveInfinity !== Number.POSITIVE_INFINITY) {
    throw new Error('Contract check failed: positiveInfinity');
  }

  if (parsed.negativeInfinity !== Number.NEGATIVE_INFINITY) {
    throw new Error('Contract check failed: negativeInfinity');
  }

  if (!Object.is(parsed.negativeZero, -0)) {
    throw new Error('Contract check failed: negativeZero');
  }

  if (!(parsed.matcher instanceof RegExp) || parsed.matcher.source !== 'livon' || parsed.matcher.flags !== 'gi') {
    throw new Error('Contract check failed: matcher');
  }

  if (!(parsed.tags instanceof Set) || parsed.tags.size !== 2) {
    throw new Error('Contract check failed: tags');
  }

  if (!(parsed.lookup instanceof Map) || parsed.lookup.size !== 2) {
    throw new Error('Contract check failed: lookup');
  }

  return {
    serializedLength: serialized.length,
  };
};

const runCase = ({ label, iterations, run }) => {
  let sink;
  const start = process.hrtime.bigint();
  for (let index = 0; index < iterations; index += 1) {
    sink = run();
  }
  const end = process.hrtime.bigint();
  const elapsedNs = Number(end - start);

  return {
    label,
    iterations,
    totalMs: elapsedNs / 1e6,
    perOpUs: (elapsedNs / iterations) / 1e3,
    opsSec: iterations / (elapsedNs / 1e9),
    sinkType: typeof sink,
  };
};

const runBenchmark = () => {
  const payload = createSetManyPayload();
  const msgpackSerialized = serializeWithMsgpackBase64(payload);
  const jsonSerialized = JSON.stringify(payload);
  const jsonReplacerSerialized = serializeWithJsonReplacer(payload);
  const encodeIterations = 20_000;
  const decodeIterations = 20_000;

  const warmupIterations = 3_000;
  for (let index = 0; index < warmupIterations; index += 1) {
    serializeWithMsgpackBase64(payload);
    JSON.stringify(payload);
    serializeWithJsonReplacer(payload);
    deserializeWithMsgpackBase64(msgpackSerialized);
    JSON.parse(jsonSerialized);
    deserializeWithJsonReviver(jsonReplacerSerialized);
  }

  const encodeResults = [
    runCase({
      label: 'encode:msgpackr+base64',
      iterations: encodeIterations,
      run: () => serializeWithMsgpackBase64(payload),
    }),
    runCase({
      label: 'encode:json.stringify',
      iterations: encodeIterations,
      run: () => JSON.stringify(payload),
    }),
    runCase({
      label: 'encode:json.stringify(replacer)',
      iterations: encodeIterations,
      run: () => serializeWithJsonReplacer(payload),
    }),
  ];

  const decodeResults = [
    runCase({
      label: 'decode:msgpackr+base64',
      iterations: decodeIterations,
      run: () => deserializeWithMsgpackBase64(msgpackSerialized),
    }),
    runCase({
      label: 'decode:json.parse',
      iterations: decodeIterations,
      run: () => JSON.parse(jsonSerialized),
    }),
    runCase({
      label: 'decode:json.parse(reviver)',
      iterations: decodeIterations,
      run: () => deserializeWithJsonReviver(jsonReplacerSerialized),
    }),
  ];

  return {
    payload: 'setMany(64)',
    encodedLength: {
      msgpackBase64: msgpackSerialized.length,
      json: jsonSerialized.length,
      jsonReplacer: jsonReplacerSerialized.length,
    },
    encodeResults,
    decodeResults,
  };
};

const contract = verifyContract();
const benchmark = runBenchmark();

console.log(JSON.stringify({
  contract,
  benchmark,
}, null, 2));
