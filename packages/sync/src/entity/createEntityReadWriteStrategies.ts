import {
  resolveAdaptiveReadWriteByCache,
  type AdaptiveReadWriteOperation,
} from '../utils/adaptiveReadWrite.js';
import type {
  EntityReadWriteConfig,
  EntityReadWriteInput,
} from '../utils/readWriteStrategy.js';
import type { CacheConfig } from './types.js';

interface ResolveEntityOperationReadWriteStrategyInput {
  readWriteConfig: EntityReadWriteConfig;
  hasExplicitBatchReadWrite: boolean;
  hasExplicitSubviewReadWrite: boolean;
  readWrite?: EntityReadWriteInput;
  cacheEnabled: boolean;
  lruEnabled: boolean;
  operation: AdaptiveReadWriteOperation;
}

export type EntityReadWriteStrategies = Record<
  AdaptiveReadWriteOperation,
  EntityReadWriteConfig
>;

const resolveEntityOperationReadWriteStrategy = ({
  readWriteConfig,
  hasExplicitBatchReadWrite,
  hasExplicitSubviewReadWrite,
  readWrite,
  cacheEnabled,
  lruEnabled,
  operation,
}: ResolveEntityOperationReadWriteStrategyInput): EntityReadWriteConfig => {
  const recommendedStrategy = resolveAdaptiveReadWriteByCache({
    cacheEnabled,
    lruEnabled,
    operation,
    fallback: readWriteConfig,
  });

  return {
    batch: hasExplicitBatchReadWrite
      ? (readWrite?.batch ?? recommendedStrategy.batch)
      : recommendedStrategy.batch,
    subview: hasExplicitSubviewReadWrite
      ? (readWrite?.subview ?? recommendedStrategy.subview)
      : recommendedStrategy.subview,
  };
};

interface CreateEntityReadWriteStrategiesInput {
  readWriteConfig: EntityReadWriteConfig;
  readWrite?: EntityReadWriteInput;
  cache?: CacheConfig;
}

export const createEntityReadWriteStrategies = ({
  readWriteConfig,
  readWrite,
  cache,
}: CreateEntityReadWriteStrategiesInput): EntityReadWriteStrategies => {
  const hasExplicitBatchReadWrite = readWrite?.batch !== undefined;
  const hasExplicitSubviewReadWrite = readWrite?.subview !== undefined;
  const cacheEnabled = Boolean(cache);
  const lruEnabled = typeof cache?.lruMaxEntries === 'number'
    && Number.isFinite(cache.lruMaxEntries)
    && cache.lruMaxEntries > 0;

  return {
    readOne: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'readOne',
    }),
    readMany: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'readMany',
    }),
    updateOne: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'updateOne',
    }),
    updateMany: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'updateMany',
    }),
    setOne: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'setOne',
    }),
    setMany: resolveEntityOperationReadWriteStrategy({
      readWriteConfig,
      hasExplicitBatchReadWrite,
      hasExplicitSubviewReadWrite,
      readWrite,
      cacheEnabled,
      lruEnabled,
      operation: 'setMany',
    }),
  };
};
