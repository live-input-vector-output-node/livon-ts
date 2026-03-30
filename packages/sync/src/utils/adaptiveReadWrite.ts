import adaptiveReadWriteMatrix from './adaptiveReadWriteMatrix.json';
import type { EntityReadWriteConfig } from './readWriteStrategy.js';

export type AdaptiveReadWriteOperation =
  | 'readOne'
  | 'readMany'
  | 'updateOne'
  | 'updateMany'
  | 'setOne'
  | 'setMany';

export type AdaptiveReadWriteProfileKey =
  | 'cache-off-lru-off'
  | 'cache-off-lru-on'
  | 'cache-on-lru-off'
  | 'cache-on-lru-on';

export type AdaptiveReadWriteIntent = 'read' | 'write';

interface AdaptiveReadWriteMatrixEntry {
  batch: boolean;
  subview: boolean;
}

interface AdaptiveReadWriteProfile {
  readOne: AdaptiveReadWriteMatrixEntry;
  readMany: AdaptiveReadWriteMatrixEntry;
  updateOne: AdaptiveReadWriteMatrixEntry;
  updateMany: AdaptiveReadWriteMatrixEntry;
  setOne: AdaptiveReadWriteMatrixEntry;
  setMany: AdaptiveReadWriteMatrixEntry;
}

interface AdaptiveReadWriteMatrix {
  version: number;
  generatedAt: string;
  profiles: Record<AdaptiveReadWriteProfileKey, AdaptiveReadWriteProfile>;
}

interface ResolveAdaptiveReadWriteProfileKeyInput {
  cacheEnabled: boolean;
  lruEnabled: boolean;
}

interface ResolveAdaptiveReadWriteConfigInput {
  profile: AdaptiveReadWriteProfileKey;
  operation: AdaptiveReadWriteOperation;
  fallback: EntityReadWriteConfig;
}

interface ResolveAdaptiveReadWriteByCacheInput {
  cacheEnabled: boolean;
  lruEnabled: boolean;
  operation: AdaptiveReadWriteOperation;
  fallback: EntityReadWriteConfig;
}

interface ResolveAdaptiveReadWriteByIntentInput {
  intent: AdaptiveReadWriteIntent;
  operation: AdaptiveReadWriteOperation;
  fallback: EntityReadWriteConfig;
}

const DEFAULT_ADAPTIVE_READ_WRITE_CONFIG: EntityReadWriteConfig = {
  batch: true,
  subview: true,
};
const READ_OPTIMIZED_STRATEGY: EntityReadWriteConfig = {
  batch: true,
  subview: true,
};
const WRITE_OPTIMIZED_STRATEGY: EntityReadWriteConfig = {
  batch: false,
  subview: false,
};
const WRITE_OPERATION_KEYS: Record<AdaptiveReadWriteOperation, true | undefined> = {
  readOne: undefined,
  readMany: undefined,
  updateOne: true,
  updateMany: true,
  setOne: true,
  setMany: true,
};
const cloneReadWriteConfig = (
  { batch, subview }: EntityReadWriteConfig,
): EntityReadWriteConfig => {
  return {
    batch,
    subview,
  };
};

const isObjectValue = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isAdaptiveReadWriteMatrixEntry = (value: unknown): value is AdaptiveReadWriteMatrixEntry => {
  if (!isObjectValue(value)) {
    return false;
  }

  return typeof value.batch === 'boolean'
    && typeof value.subview === 'boolean';
};

const isAdaptiveReadWriteProfile = (value: unknown): value is AdaptiveReadWriteProfile => {
  if (!isObjectValue(value)) {
    return false;
  }

  return isAdaptiveReadWriteMatrixEntry(value.readOne)
    && isAdaptiveReadWriteMatrixEntry(value.readMany)
    && isAdaptiveReadWriteMatrixEntry(value.updateOne)
    && isAdaptiveReadWriteMatrixEntry(value.updateMany)
    && isAdaptiveReadWriteMatrixEntry(value.setOne)
    && isAdaptiveReadWriteMatrixEntry(value.setMany);
};

const isAdaptiveReadWriteProfileMap = (
  value: unknown,
): value is Record<AdaptiveReadWriteProfileKey, AdaptiveReadWriteProfile> => {
  if (!isObjectValue(value)) {
    return false;
  }

  return isAdaptiveReadWriteProfile(value['cache-off-lru-off'])
    && isAdaptiveReadWriteProfile(value['cache-off-lru-on'])
    && isAdaptiveReadWriteProfile(value['cache-on-lru-off'])
    && isAdaptiveReadWriteProfile(value['cache-on-lru-on']);
};

const isAdaptiveReadWriteMatrix = (value: unknown): value is AdaptiveReadWriteMatrix => {
  if (!isObjectValue(value)) {
    return false;
  }

  if (typeof value.version !== 'number') {
    return false;
  }

  if (typeof value.generatedAt !== 'string') {
    return false;
  }

  return isAdaptiveReadWriteProfileMap(value.profiles);
};

const resolveMatrix = (): AdaptiveReadWriteMatrix | null => {
  if (!isAdaptiveReadWriteMatrix(adaptiveReadWriteMatrix)) {
    return null;
  }

  return adaptiveReadWriteMatrix;
};

const adaptiveReadWriteMatrixValue = resolveMatrix();

const createEntityReadWriteConfig = (
  value: AdaptiveReadWriteMatrixEntry,
): EntityReadWriteConfig => {
  return {
    batch: value.batch,
    subview: value.subview,
  };
};

export const resolveAdaptiveReadWriteProfileKey = ({
  cacheEnabled,
  lruEnabled,
}: ResolveAdaptiveReadWriteProfileKeyInput): AdaptiveReadWriteProfileKey => {
  if (!cacheEnabled && !lruEnabled) {
    return 'cache-off-lru-off';
  }

  if (!cacheEnabled && lruEnabled) {
    return 'cache-off-lru-on';
  }

  if (cacheEnabled && !lruEnabled) {
    return 'cache-on-lru-off';
  }

  return 'cache-on-lru-on';
};

export const resolveAdaptiveReadWriteConfig = ({
  profile,
  operation,
  fallback,
}: ResolveAdaptiveReadWriteConfigInput): EntityReadWriteConfig => {
  const matrix = adaptiveReadWriteMatrixValue;
  if (!matrix) {
    return fallback;
  }

  const profileValue = matrix.profiles[profile];
  const operationValue = profileValue[operation];
  if (!operationValue) {
    return fallback;
  }

  return createEntityReadWriteConfig(operationValue);
};

export const resolveAdaptiveReadWriteByCache = ({
  cacheEnabled,
  lruEnabled,
  operation,
  fallback,
}: ResolveAdaptiveReadWriteByCacheInput): EntityReadWriteConfig => {
  const profile = resolveAdaptiveReadWriteProfileKey({
    cacheEnabled,
    lruEnabled,
  });
  return resolveAdaptiveReadWriteConfig({
    profile,
    operation,
    fallback,
  });
};

export const resolveAdaptiveReadWriteByIntent = ({
  intent,
  operation,
  fallback,
}: ResolveAdaptiveReadWriteByIntentInput): EntityReadWriteConfig => {
  if (intent === 'write') {
    if (!WRITE_OPERATION_KEYS[operation]) {
      return fallback;
    }

    return cloneReadWriteConfig(WRITE_OPTIMIZED_STRATEGY);
  }

  if (WRITE_OPERATION_KEYS[operation]) {
    return fallback;
  }

  return cloneReadWriteConfig(READ_OPTIMIZED_STRATEGY);
};

export const resolveAdaptiveReadWriteDefault = (): EntityReadWriteConfig => {
  return DEFAULT_ADAPTIVE_READ_WRITE_CONFIG;
};
