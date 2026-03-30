import { type CacheTtl } from '../entity.js';
import {
  readOrCreateSharedIndexedDbCacheStorage,
} from '../utils/index.js';
import type {
  IsCacheRecordExpiredInput,
  ResolveCacheLruMaxEntriesInput,
  ResolveCacheKeyInput,
  ResolveCacheTtlInput,
  SourceCacheRecord,
  SourceUnitInternal,
} from './types.js';
export {
  getModeValue,
  isEntityArray,
  isEntityValue,
} from '../utils/entityMode.js';

const DEFAULT_CACHE_TTL: CacheTtl = 0;
const DEFAULT_CACHE_LRU_MAX_ENTRIES = 256;
const DISABLED_CACHE_LRU_MAX_ENTRIES = 0;
const DEFAULT_CACHE_KEY_PREFIX = 'livon-sync-source';

const isRecordValue = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const hasStringKeysArray = (value: unknown): value is { keys: readonly string[] } => {
  if (!isRecordValue(value)) {
    return false;
  }

  const keysValue = value.keys;
  if (!Array.isArray(keysValue)) {
    return false;
  }

  return keysValue.every((entry) => typeof entry === 'string');
};

const isSourceCacheRecordValue = <TEntity extends object>(
  value: unknown,
): value is SourceCacheRecord<TEntity> => {
  if (!isRecordValue(value)) {
    return false;
  }

  const mode = value.mode;
  const entities = value.entities;
  const writtenAt = value.writtenAt;
  if (mode !== 'one' && mode !== 'many') {
    return false;
  }

  if (!Array.isArray(entities)) {
    return false;
  }

  if (typeof writtenAt !== 'number' || Number.isNaN(writtenAt)) {
    return false;
  }

  return true;
};

export const resolveCacheTtl = ({
  sourceCache,
  entityCache,
}: ResolveCacheTtlInput): CacheTtl => {
  if (sourceCache && sourceCache.ttl !== undefined) {
    return sourceCache.ttl;
  }

  if (entityCache && entityCache.ttl !== undefined) {
    return entityCache.ttl;
  }

  return DEFAULT_CACHE_TTL;
};

export const resolveCacheStorage = () => {
  return readOrCreateSharedIndexedDbCacheStorage();
};

export const resolveCacheLruMaxEntries = ({
  sourceCache,
  entityCache,
}: ResolveCacheLruMaxEntriesInput): number => {
  if (sourceCache && sourceCache.lruMaxEntries !== undefined) {
    const sourceLruMaxEntries = sourceCache.lruMaxEntries;
    if (Number.isFinite(sourceLruMaxEntries) && sourceLruMaxEntries > 0) {
      return Math.floor(sourceLruMaxEntries);
    }

    return DISABLED_CACHE_LRU_MAX_ENTRIES;
  }

  if (entityCache && entityCache.lruMaxEntries !== undefined) {
    const entityLruMaxEntries = entityCache.lruMaxEntries;
    if (Number.isFinite(entityLruMaxEntries) && entityLruMaxEntries > 0) {
      return Math.floor(entityLruMaxEntries);
    }

    return DISABLED_CACHE_LRU_MAX_ENTRIES;
  }

  return DEFAULT_CACHE_LRU_MAX_ENTRIES;
};

export const resolveCacheKey = ({
  sourceKey,
}: ResolveCacheKeyInput): string => {
  return `${DEFAULT_CACHE_KEY_PREFIX}:${sourceKey}`;
};

export const isCacheRecordExpired = ({
  ttl,
  writtenAt,
}: IsCacheRecordExpiredInput): boolean => {
  if (ttl === 'infinity') {
    return false;
  }

  if (ttl <= 0) {
    return true;
  }

  return Date.now() - writtenAt > ttl;
};

export const readSourceCacheRecord = <TEntity extends object>(
  value: unknown | null,
): SourceCacheRecord<TEntity> | undefined => {
  if (!value) {
    return undefined;
  }

  if (!isSourceCacheRecordValue<TEntity>(value)) {
    return undefined;
  }

  return value;
};

export const shouldUseCache = <
  TIdentity extends object | undefined,
  TPayload,
  TData,
  TMeta,
>(
  internal: SourceUnitInternal<TIdentity, TPayload, TData, TMeta>,
): boolean => {
  if (internal.ttl <= 0) {
    return false;
  }

  if (internal.lastRunAt === null) {
    return false;
  }

  return Date.now() - internal.lastRunAt < internal.ttl;
};

export { hasStringKeysArray, isRecordValue };

export const areDraftValuesEqual = (
  previousValue: unknown,
  nextValue: unknown,
): boolean => {
  if (Object.is(previousValue, nextValue)) {
    return true;
  }

  if (!isRecordValue(previousValue) || !isRecordValue(nextValue)) {
    return false;
  }

  const previousKeys = Object.keys(previousValue);
  const nextKeys = Object.keys(nextValue);

  if (previousKeys.length !== nextKeys.length) {
    return false;
  }

  return previousKeys.every((key) => Object.is(previousValue[key], nextValue[key]));
};
