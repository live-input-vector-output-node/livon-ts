import { serializeKey } from './serializeKey.js';

export interface CreateSerializedKeyCacheConfig {
  mode?: SerializedKeyCacheMode;
  limit?: number;
  cacheObjects?: boolean;
  cachePrimitives?: boolean;
}

export interface SerializedKeyCache {
  getOrCreateKey: (input: unknown) => string;
  clear: () => void;
}

export type SerializedKeyCacheMode = 'scoped-unit' | 'payload-hot-path' | 'dependency';

interface SerializedKeyCacheModeDefaults {
  cacheObjects: boolean;
  cachePrimitives: boolean;
}

const isObjectInput = (input: unknown): input is object => {
  return input !== null && typeof input === 'object';
};

const resolveModeDefaults = (mode: SerializedKeyCacheMode): SerializedKeyCacheModeDefaults => {
  if (mode === 'payload-hot-path') {
    return {
      cacheObjects: false,
      cachePrimitives: true,
    };
  }

  if (mode === 'dependency') {
    return {
      cacheObjects: false,
      cachePrimitives: false,
    };
  }

  return {
    cacheObjects: true,
    cachePrimitives: true,
  };
};

export const createSerializedKeyCache = ({
  mode = 'scoped-unit',
  limit,
  cacheObjects,
  cachePrimitives,
}: CreateSerializedKeyCacheConfig = {}): SerializedKeyCache => {
  const modeDefaults = resolveModeDefaults(mode);
  const shouldCacheObjects = cacheObjects ?? modeDefaults.cacheObjects;
  const shouldCachePrimitives = cachePrimitives ?? modeDefaults.cachePrimitives;
  const keyByPrimitiveInput = new Map<unknown, string>();
  const primitiveInputOrder = new Set<unknown>();
  const keyByObjectInput = new WeakMap<object, string>();
  const isLimitEnabled = limit !== undefined && limit >= 0;

  const getOrCreateKey = (input: unknown): string => {
    if (isObjectInput(input)) {
      if (!shouldCacheObjects) {
        return serializeKey(input);
      }

      const existingObjectKey = keyByObjectInput.get(input);
      if (existingObjectKey !== undefined) {
        return existingObjectKey;
      }

      const createdObjectKey = serializeKey(input);
      keyByObjectInput.set(input, createdObjectKey);
      return createdObjectKey;
    }

    if (!shouldCachePrimitives) {
      return serializeKey(input);
    }

    const existingPrimitiveKey = keyByPrimitiveInput.get(input);
    if (existingPrimitiveKey !== undefined) {
      primitiveInputOrder.delete(input);
      primitiveInputOrder.add(input);
      return existingPrimitiveKey;
    }

    const createdPrimitiveKey = serializeKey(input);
    keyByPrimitiveInput.set(input, createdPrimitiveKey);
    primitiveInputOrder.add(input);

    if (isLimitEnabled && keyByPrimitiveInput.size > limit) {
      const oldestPrimitiveInput = primitiveInputOrder.values().next().value;
      if (oldestPrimitiveInput !== undefined) {
        primitiveInputOrder.delete(oldestPrimitiveInput);
        keyByPrimitiveInput.delete(oldestPrimitiveInput);
      }
    }

    return createdPrimitiveKey;
  };

  const clear = (): void => {
    keyByPrimitiveInput.clear();
    primitiveInputOrder.clear();
  };

  return {
    getOrCreateKey,
    clear,
  };
};
