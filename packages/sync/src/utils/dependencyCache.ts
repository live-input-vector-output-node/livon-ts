import { createSerializedKeyCache } from './serializedKeyCache.js';

const DEFAULT_SECONDARY_KEY = '__default__';

export interface CreateDependencyCacheConfig {
  limit?: number;
}

export interface DependencyCacheGetOrCreateInput<TInstance> {
  primaryDependencies: readonly unknown[];
  secondaryDependencies?: readonly unknown[];
  build: () => TInstance;
}

export interface DependencyCacheDeleteInput {
  primaryDependencies: readonly unknown[];
  secondaryDependencies?: readonly unknown[];
}

export interface DependencyCacheClearPrimaryInput {
  primaryDependencies: readonly unknown[];
}

export interface DependencyCache<TInstance> {
  getOrCreate: (input: DependencyCacheGetOrCreateInput<TInstance>) => TInstance;
  delete: (input: DependencyCacheDeleteInput) => boolean;
  clearPrimary: (input: DependencyCacheClearPrimaryInput) => void;
  clear: () => void;
}

interface DependencyCacheEntry<TInstance> {
  instance: TInstance;
}

export const createDependencyCache = <TInstance>({
  limit,
}: CreateDependencyCacheConfig = {}): DependencyCache<TInstance> => {
  const entriesByPrimaryKey = new Map<string, Map<string, DependencyCacheEntry<TInstance>>>();
  const keyCache = createSerializedKeyCache({
    mode: 'dependency',
  });
  const isLimitEnabled = limit !== undefined && limit >= 0;

  const resolvePrimaryKey = (dependencies: readonly unknown[]): string => {
    return keyCache.getOrCreateKey(dependencies);
  };

  const resolveSecondaryKey = (dependencies?: readonly unknown[]): string => {
    if (!dependencies) {
      return DEFAULT_SECONDARY_KEY;
    }

    return keyCache.getOrCreateKey(dependencies);
  };

  const getOrCreate = ({
    primaryDependencies,
    secondaryDependencies,
    build,
  }: DependencyCacheGetOrCreateInput<TInstance>): TInstance => {
    const primaryKey = resolvePrimaryKey(primaryDependencies);
    const secondaryKey = resolveSecondaryKey(secondaryDependencies);
    const entriesBySecondaryKey = entriesByPrimaryKey.get(primaryKey)
      ?? new Map<string, DependencyCacheEntry<TInstance>>();

    if (entriesBySecondaryKey.has(secondaryKey)) {
      const existingEntry = entriesBySecondaryKey.get(secondaryKey);
      if (!existingEntry) {
        const nextEntry = {
          instance: build(),
        };
        entriesBySecondaryKey.set(secondaryKey, nextEntry);
        entriesByPrimaryKey.set(primaryKey, entriesBySecondaryKey);
        return nextEntry.instance;
      }

      entriesBySecondaryKey.delete(secondaryKey);
      entriesBySecondaryKey.set(secondaryKey, existingEntry);
      entriesByPrimaryKey.set(primaryKey, entriesBySecondaryKey);
      return existingEntry.instance;
    }

    const nextEntry = {
      instance: build(),
    };
    entriesBySecondaryKey.set(secondaryKey, nextEntry);

    if (isLimitEnabled && entriesBySecondaryKey.size > limit) {
      const oldestSecondaryKey = entriesBySecondaryKey.keys().next().value;
      if (oldestSecondaryKey !== undefined) {
        entriesBySecondaryKey.delete(oldestSecondaryKey);
      }
    }

    if (entriesBySecondaryKey.size === 0) {
      entriesByPrimaryKey.delete(primaryKey);
      return nextEntry.instance;
    }

    entriesByPrimaryKey.set(primaryKey, entriesBySecondaryKey);
    return nextEntry.instance;
  };

  const removeEntry = ({
    primaryDependencies,
    secondaryDependencies,
  }: DependencyCacheDeleteInput): boolean => {
    const primaryKey = resolvePrimaryKey(primaryDependencies);
    const secondaryKey = resolveSecondaryKey(secondaryDependencies);
    const entriesBySecondaryKey = entriesByPrimaryKey.get(primaryKey);
    if (!entriesBySecondaryKey) {
      return false;
    }

    const removed = entriesBySecondaryKey.delete(secondaryKey);
    if (entriesBySecondaryKey.size === 0) {
      entriesByPrimaryKey.delete(primaryKey);
    }

    return removed;
  };

  const clearPrimary = ({
    primaryDependencies,
  }: DependencyCacheClearPrimaryInput): void => {
    const primaryKey = resolvePrimaryKey(primaryDependencies);
    entriesByPrimaryKey.delete(primaryKey);
  };

  const clear = (): void => {
    entriesByPrimaryKey.clear();
    keyCache.clear();
  };

  return {
    getOrCreate,
    delete: removeEntry,
    clearPrimary,
    clear,
  };
};
