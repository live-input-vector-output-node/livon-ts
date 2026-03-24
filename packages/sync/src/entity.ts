import { defaultRuntimeQueue } from './runtimeQueue/index.js';

export interface UpsertOptions {
  merge?: boolean;
}

export type EntityId = string | number | symbol;
export type DraftMode = 'global' | 'scoped' | 'off';
export type CacheTtl = number | 'infinity';

export interface CacheStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface CacheConfig {
  key?: string;
  ttl?: CacheTtl;
  storage?: CacheStorage;
}

export interface RegisterEntityUnitInput {
  key: string;
  onChange: () => void;
}

export interface SetEntityUnitMembershipInput<TId extends EntityId> {
  key: string;
  ids: readonly TId[];
}

export interface EntityConfig<
  TInput extends object,
  TId extends EntityId = string,
> {
  idOf: (input: TInput) => TId;
  ttl?: number;
  destroyDelay?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
}

export type EntityByIdMap<TInput extends object, TId extends EntityId> = Map<TId, TInput>;

export interface Entity<
  TInput extends object = object,
  TId extends EntityId = string,
> {
  ttl?: number;
  destroyDelay?: number;
  draft?: DraftMode;
  cache?: CacheConfig;
  idOf: (input: TInput) => TId;
  entitiesById: EntityByIdMap<TInput, TId>;
  getDraftById: (id: TId) => TInput | undefined;
  setDraftById: (id: TId, input: TInput) => TInput;
  clearDraftById: (id: TId) => boolean;
  getById: (id: TId) => TInput | undefined;
  registerUnit: (input: RegisterEntityUnitInput) => () => void;
  setUnitMembership: (input: SetEntityUnitMembershipInput<TId>) => void;
  clearUnitMembership: (key: string) => void;
  upsertOne: (input: TInput, options?: UpsertOptions) => TInput;
  upsertMany: (input: readonly TInput[], options?: UpsertOptions) => readonly TInput[];
  removeOne: (id: TId) => boolean;
  removeMany: (ids: readonly TId[]) => readonly TId[];
}

interface MergeEntityInput<TInput extends object> {
  current: TInput | undefined;
  next: TInput;
  shouldMerge: boolean;
}

interface IsEquivalentEntityInput<TInput extends object> {
  current: TInput;
  next: TInput;
}

const isEquivalentReplace = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  const currentEntries = Object.entries(current);
  const nextEntries = Object.entries(next);
  if (currentEntries.length !== nextEntries.length) {
    return false;
  }

  const currentValuesByKey = new Map<string, unknown>(currentEntries);
  return nextEntries.every(([key, nextValue]) => {
    if (!currentValuesByKey.has(key)) {
      return false;
    }

    return Object.is(currentValuesByKey.get(key), nextValue);
  });
};

const isEquivalentMerge = <TInput extends object>({
  current,
  next,
}: IsEquivalentEntityInput<TInput>): boolean => {
  const currentValuesByKey = new Map<string, unknown>(Object.entries(current));
  return Object.entries(next).every(([key, nextValue]) => {
    if (!currentValuesByKey.has(key)) {
      return false;
    }

    return Object.is(currentValuesByKey.get(key), nextValue);
  });
};

const mergeEntity = <TInput extends object>({
  current,
  next,
  shouldMerge,
}: MergeEntityInput<TInput>): TInput => {
  if (!current) {
    return next;
  }

  if (!shouldMerge) {
    if (isEquivalentReplace({ current, next })) {
      return current;
    }

    return next;
  }

  if (isEquivalentMerge({ current, next })) {
    return current;
  }

  return {
    ...current,
    ...next,
  };
};

interface EntityUnitState<TId extends EntityId> {
  onChange: () => void;
  membershipIds: Set<TId>;
}

interface EntityUnitKeyInput<TId extends EntityId> {
  id: TId;
  key: string;
}

let nextEntityQueueId = 0;

export const entity = <
  TInput extends object,
  TId extends EntityId = string,
>({
  idOf,
  ttl,
  destroyDelay,
  draft,
  cache,
}: EntityConfig<TInput, TId>): Entity<TInput, TId> => {
  const entitiesById: EntityByIdMap<TInput, TId> = new Map<TId, TInput>();
  const draftsById: EntityByIdMap<TInput, TId> = new Map<TId, TInput>();
  const unitStateByKey = new Map<string, EntityUnitState<TId>>();
  const unitKeysById = new Map<TId, Set<string>>();
  const dirtyUnitKeys = new Set<string>();
  nextEntityQueueId += 1;
  const dirtyUnitsQueueKey = `entity-dirty:${nextEntityQueueId}`;

  const getById = (id: TId): TInput | undefined => {
    return entitiesById.get(id);
  };

  const getDraftById = (id: TId): TInput | undefined => {
    return draftsById.get(id);
  };

  const removeUnitKeyFromId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    const keys = unitKeysById.get(id);

    if (!keys) {
      return;
    }

    keys.delete(key);
    if (keys.size === 0) {
      unitKeysById.delete(id);
    }
  };

  const addUnitKeyToId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    const existingKeys = unitKeysById.get(id);
    if (existingKeys) {
      existingKeys.add(key);
      return;
    }

    unitKeysById.set(id, new Set<string>([key]));
  };

  const clearUnitMembership = (key: string): void => {
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    unitState.membershipIds.forEach((id) => {
      removeUnitKeyFromId({ id, key });
    });
    unitState.membershipIds.clear();
  };

  const unregisterUnit = (key: string): void => {
    clearUnitMembership(key);
    unitStateByKey.delete(key);
  };

  const registerUnit = ({
    key,
    onChange,
  }: RegisterEntityUnitInput): (() => void) => {
    unregisterUnit(key);
    unitStateByKey.set(key, {
      onChange,
      membershipIds: new Set<TId>(),
    });

    return () => {
      unregisterUnit(key);
    };
  };

  const setUnitMembership = ({
    key,
    ids,
  }: SetEntityUnitMembershipInput<TId>): void => {
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    const currentMembershipIds = unitState.membershipIds;
    if (ids.length === 1) {
      const [nextSingleMembershipId] = ids;
      if (nextSingleMembershipId === undefined) {
        return;
      }

      if (currentMembershipIds.size === 1) {
        const currentSingleMembershipId = currentMembershipIds.values().next().value;
        if (currentSingleMembershipId === nextSingleMembershipId) {
          return;
        }

        if (currentSingleMembershipId !== undefined) {
          removeUnitKeyFromId({ id: currentSingleMembershipId, key });
        }

        currentMembershipIds.clear();
        currentMembershipIds.add(nextSingleMembershipId);
        addUnitKeyToId({ id: nextSingleMembershipId, key });
        return;
      }

      currentMembershipIds.forEach((id) => {
        removeUnitKeyFromId({ id, key });
      });
      currentMembershipIds.clear();
      currentMembershipIds.add(nextSingleMembershipId);
      addUnitKeyToId({ id: nextSingleMembershipId, key });
      return;
    }

    if (currentMembershipIds.size === ids.length) {
      const hasDifferentId = ids.some((id) => !currentMembershipIds.has(id));
      if (!hasDifferentId) {
        return;
      }
    }

    const nextMembershipIds = new Set<TId>(ids);

    currentMembershipIds.forEach((id) => {
      if (!nextMembershipIds.has(id)) {
        removeUnitKeyFromId({ id, key });
      }
    });

    nextMembershipIds.forEach((id) => {
      if (!currentMembershipIds.has(id)) {
        addUnitKeyToId({ id, key });
      }
    });

    unitState.membershipIds = nextMembershipIds;
  };

  const notifyUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);

    if (!unitKeys) {
      return;
    }

    Array.from(unitKeys).forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });
  };

  const setDraftById = (id: TId, input: TInput): TInput => {
    draftsById.set(id, input);
    notifyUnitsById(id);

    return input;
  };

  const clearDraftById = (id: TId): boolean => {
    const existed = draftsById.delete(id);

    if (!existed) {
      return false;
    }

    notifyUnitsById(id);

    return true;
  };

  const flushDirtyUnits = (): void => {
    const keys = Array.from(dirtyUnitKeys);
    dirtyUnitKeys.clear();

    keys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });
  };

  const scheduleDirtyUnitsFlush = (): void => {
    defaultRuntimeQueue.enqueue({
      channel: 'state',
      key: dirtyUnitsQueueKey,
      run: flushDirtyUnits,
    });
  };

  const queueUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);
    if (!unitKeys) {
      return;
    }

    Array.from(unitKeys).forEach((key) => {
      dirtyUnitKeys.add(key);
    });

    scheduleDirtyUnitsFlush();
  };

  const upsertOne = (input: TInput, options?: UpsertOptions): TInput => {
    const id = idOf(input);
    const currentEntity = entitiesById.get(id);
    const mergedInput = mergeEntity({
      current: currentEntity,
      next: input,
      shouldMerge: Boolean(options?.merge),
    });

    if (Object.is(currentEntity, mergedInput)) {
      return mergedInput;
    }

    entitiesById.set(id, mergedInput);
    notifyUnitsById(id);

    return mergedInput;
  };

  const upsertMany = (input: readonly TInput[], options?: UpsertOptions): readonly TInput[] => {
    const changedIds = new Set<TId>();
    let hasDuplicates = false;
    const mergedValues: TInput[] = [];

    input.forEach((entry) => {
      const id = idOf(entry);
      const currentEntity = entitiesById.get(id);
      const mergedInput = mergeEntity({
        current: currentEntity,
        next: entry,
        shouldMerge: Boolean(options?.merge),
      });

      const changed = !Object.is(currentEntity, mergedInput);
      if (changed) {
        entitiesById.set(id, mergedInput);
        const changedIdCountBefore = changedIds.size;
        changedIds.add(id);
        if (changedIds.size === changedIdCountBefore) {
          hasDuplicates = true;
        }
      }

      mergedValues.push(mergedInput);
    });

    changedIds.forEach((id) => {
      if (hasDuplicates) {
        queueUnitsById(id);
        return;
      }

      notifyUnitsById(id);
    });

    return mergedValues;
  };

  const removeOne = (id: TId): boolean => {
    const existed = entitiesById.delete(id);
    draftsById.delete(id);

    if (!existed) {
      return false;
    }

    const affectedKeys = Array.from(unitKeysById.get(id) ?? []);

    affectedKeys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      if (!unitState) {
        return;
      }

      unitState.membershipIds.delete(id);
    });

    unitKeysById.delete(id);

    affectedKeys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });

    return true;
  };

  const removeMany = (ids: readonly TId[]): readonly TId[] => {
    return ids.filter((id) => {
      return removeOne(id);
    });
  };

  return {
    ttl,
    destroyDelay,
    draft,
    cache,
    idOf,
    entitiesById,
    getDraftById,
    setDraftById,
    clearDraftById,
    getById,
    registerUnit,
    setUnitMembership,
    clearUnitMembership,
    upsertOne,
    upsertMany,
    removeOne,
    removeMany,
  };
};
