import { serializeKey } from './serializeKey.js';

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

const toPrimaryKey = (dependencies: readonly unknown[]): string => {
  return serializeKey(dependencies);
};

const toSecondaryKey = (dependencies?: readonly unknown[]): string => {
  if (!dependencies) {
    return DEFAULT_SECONDARY_KEY;
  }

  return serializeKey(dependencies);
};

export const createDependencyCache = <TInstance>({
  limit,
}: CreateDependencyCacheConfig = {}): DependencyCache<TInstance> => {
  const entriesByPrimaryKey = new Map<string, Map<string, TInstance>>();

  const getOrCreate = ({
    primaryDependencies,
    secondaryDependencies,
    build,
  }: DependencyCacheGetOrCreateInput<TInstance>): TInstance => {
    const primaryKey = toPrimaryKey(primaryDependencies);
    const secondaryKey = toSecondaryKey(secondaryDependencies);
    const entriesBySecondaryKey = entriesByPrimaryKey.get(primaryKey) ?? new Map<string, TInstance>();

    const existingEntry = entriesBySecondaryKey.get(secondaryKey);
    if (existingEntry !== undefined) {
      entriesBySecondaryKey.delete(secondaryKey);
      entriesBySecondaryKey.set(secondaryKey, existingEntry);
      entriesByPrimaryKey.set(primaryKey, entriesBySecondaryKey);
      return existingEntry;
    }

    const nextEntry = build();
    entriesBySecondaryKey.set(secondaryKey, nextEntry);

    if (limit !== undefined && limit >= 0 && entriesBySecondaryKey.size > limit) {
      const oldestSecondaryKey = entriesBySecondaryKey.keys().next().value;
      if (oldestSecondaryKey !== undefined) {
        entriesBySecondaryKey.delete(oldestSecondaryKey);
      }
    }

    entriesByPrimaryKey.set(primaryKey, entriesBySecondaryKey);
    return nextEntry;
  };

  const removeEntry = ({
    primaryDependencies,
    secondaryDependencies,
  }: DependencyCacheDeleteInput): boolean => {
    const primaryKey = toPrimaryKey(primaryDependencies);
    const secondaryKey = toSecondaryKey(secondaryDependencies);
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
    const primaryKey = toPrimaryKey(primaryDependencies);
    entriesByPrimaryKey.delete(primaryKey);
  };

  const clear = (): void => {
    entriesByPrimaryKey.clear();
  };

  return {
    getOrCreate,
    delete: removeEntry,
    clearPrimary,
    clear,
  };
};
