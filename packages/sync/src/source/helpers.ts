import { Packr } from 'msgpackr';

import { type CacheStorage, type CacheTtl, type EntityId } from '../entity.js';
import {
  decodeBase64,
  deserializeStructuredValue,
  encodeBase64,
  serializeStructuredValue,
} from '../utils/index.js';
import type {
  IsCacheRecordExpiredInput,
  ResolveCacheKeyInput,
  ResolveCacheStorageInput,
  ResolveCacheTtlInput,
  SourceCacheRecord,
  SourceCleanup,
  SourceRunResult,
  SourceUnitInternal,
} from './types.js';
export {
  getModeValue,
  isEntityArray,
  isEntityValue,
} from '../utils/entityMode.js';

const DEFAULT_CACHE_TTL: CacheTtl = 0;
const DEFAULT_CACHE_KEY_PREFIX = 'livon-sync-source';
const SOURCE_CACHE_MSGPACK_PREFIX = 'm1:';
const SOURCE_CACHE_STRUCTURED_PREFIX = 's1:';
const sourceCachePackr = new Packr({
  structuredClone: true,
  moreTypes: true,
});

export const serializeSourceCacheRecord = <TEntity extends object>(
  record: SourceCacheRecord<TEntity>,
): string => {
  try {
    const packed = sourceCachePackr.pack(record);
    return `${SOURCE_CACHE_MSGPACK_PREFIX}${encodeBase64(packed)}`;
  } catch {
    const structured = serializeStructuredValue({
      input: record,
    });
    return `${SOURCE_CACHE_STRUCTURED_PREFIX}${structured}`;
  }
};

const deserializeSourceCacheRecord = <TEntity extends object>(
  value: string,
): SourceCacheRecord<TEntity> | undefined => {
  try {
    if (value.startsWith(SOURCE_CACHE_MSGPACK_PREFIX)) {
      const base64Payload = value.slice(SOURCE_CACHE_MSGPACK_PREFIX.length);
      const decoded = sourceCachePackr.unpack(decodeBase64(base64Payload));
      if (decoded && typeof decoded === 'object') {
        return decoded as SourceCacheRecord<TEntity>;
      }
      return undefined;
    }

    if (value.startsWith(SOURCE_CACHE_STRUCTURED_PREFIX)) {
      const structuredPayload = value.slice(SOURCE_CACHE_STRUCTURED_PREFIX.length);
      return deserializeStructuredValue<SourceCacheRecord<TEntity>>(structuredPayload);
    }

    return deserializeStructuredValue<SourceCacheRecord<TEntity>>(value);
  } catch {
    return undefined;
  }
};

const resolveGlobalStorage = (): CacheStorage | undefined => {
  const maybeStorage = globalThis as { localStorage?: CacheStorage };
  const localStorage = maybeStorage.localStorage;

  if (!localStorage) {
    return undefined;
  }

  if (
    typeof localStorage.getItem !== 'function'
    || typeof localStorage.setItem !== 'function'
    || typeof localStorage.removeItem !== 'function'
  ) {
    return undefined;
  }

  return localStorage;
};

const globalStorage = resolveGlobalStorage();

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

export const resolveCacheStorage = ({
  sourceCache,
  entityCache,
}: ResolveCacheStorageInput): CacheStorage | undefined => {
  if (sourceCache && sourceCache.storage) {
    return sourceCache.storage;
  }

  if (entityCache && entityCache.storage) {
    return entityCache.storage;
  }

  return globalStorage;
};

export const resolveCacheKey = ({
  sourceCache,
  entityCache,
  sourceKey,
}: ResolveCacheKeyInput): string => {
  const sourceKeyPrefix = sourceCache?.key;
  if (sourceKeyPrefix) {
    return `${sourceKeyPrefix}:${sourceKey}`;
  }

  const entityKeyPrefix = entityCache?.key;
  if (entityKeyPrefix) {
    return `${entityKeyPrefix}:${sourceKey}`;
  }

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
  value: string | null,
): SourceCacheRecord<TEntity> | undefined => {
  if (!value) {
    return undefined;
  }

  const parsed = deserializeSourceCacheRecord<TEntity>(value);
  if (!parsed || typeof parsed !== 'object') {
    return undefined;
  }

  if ((parsed.mode !== 'one' && parsed.mode !== 'many') || !Array.isArray(parsed.entities)) {
    return undefined;
  }

  if (typeof parsed.writtenAt !== 'number' || Number.isNaN(parsed.writtenAt)) {
    return undefined;
  }

  return parsed;
};

export const shouldUseCache = <
  TInput extends object | undefined,
  TPayload,
  TEntityId extends EntityId,
  RResult,
  UUpdate extends RResult,
>(
  internal: SourceUnitInternal<TInput, TPayload, TEntityId, RResult, UUpdate>,
): boolean => {
  if (internal.ttl <= 0) {
    return false;
  }

  if (internal.lastRunAt === null) {
    return false;
  }

  return Date.now() - internal.lastRunAt < internal.ttl;
};

export const invokeSourceCleanup = (
  cleanup: SourceCleanup | null,
): void => {
  if (!cleanup) {
    return;
  }

  try {
    cleanup();
  } catch {
    return;
  }
};

export const isSourceCleanup = <RResult>(
  input: SourceRunResult<RResult>,
): input is SourceCleanup => {
  return typeof input === 'function';
};

export const isRecordValue = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

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
