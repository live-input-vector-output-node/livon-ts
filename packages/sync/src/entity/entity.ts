import {
  resolveEntityReadWriteConfig,
} from '../utils/readWriteStrategy.js';
import { createEntityReadWriteStrategies } from './createEntityReadWriteStrategies.js';
import { createMembershipMethods } from './createMembershipMethods.js';
import { createMutationMethods } from './createMutationMethods.js';
import { createOrphanMethods } from './createOrphanMethods.js';
import { createQueueMethods } from './createQueueMethods.js';
import type {
  Entity,
  EntityByIdMap,
  EntityConfig,
  EntityDraftCommitInput,
  EntityDraftIdentityInput,
  EntityDraftMode,
  EntityDraftOptions,
  EntityId,
  EntityReadByIdentityContextInput,
  EntityUnitState,
  UpsertOptions,
} from './types.js';

let nextEntityQueueId = 0;
const DEFAULT_ENTITY_DRAFT_MODE: EntityDraftMode = 'global';

export const entity = <
  TInput extends object,
  TId extends EntityId = string,
>({
  key,
  idOf,
  ttl,
  destroyDelay,
  cache,
  readWrite,
}: EntityConfig<TInput, TId>): Entity<TInput, TId> => {
  const entitiesById: EntityByIdMap<TInput, TId> = new Map<TId, TInput>();
  const unitStateByKey = new Map<string, EntityUnitState<TId>>();
  const unitKeysById = new Map<TId, Set<string>>();
  const dirtyUnitKeys = new Set<string>();

  nextEntityQueueId += 1;
  const dirtyUnitsQueueKey = `entity-dirty:${nextEntityQueueId}`;

  const readWriteConfig = resolveEntityReadWriteConfig(readWrite);
  const readWriteStrategies = createEntityReadWriteStrategies({
    readWriteConfig,
    readWrite,
    cache,
  });
  const defaultReadWriteStrategy = readWriteStrategies.readMany;

  const {
    getById: getBaseById,
    sweepExpiredOrphansIfNeeded,
    clearOrphanCleanupSchedule,
    syncOrphanSweepTimeoutByScan,
    removeUnitKeyFromId,
    addUnitKeyToId,
  } = createOrphanMethods({
    cache,
    ttl,
    entitiesById,
    unitKeysById,
  });

  const {
    clearUnitMembership,
    registerUnit,
    setUnitMembership,
  } = createMembershipMethods({
    unitStateByKey,
    sweepExpiredOrphansIfNeeded,
    removeUnitKeyFromId,
    addUnitKeyToId,
  });

  const {
    notifyUnitsById,
    notifyUnitByKey,
    queueUnitsByKeys,
    queueUnitsByIds,
    queueUnitsById,
  } = createQueueMethods({
    unitStateByKey,
    unitKeysById,
    dirtyUnitKeys,
    dirtyUnitsQueueKey,
  });

  const {
    upsertOne: upsertOneBase,
    upsertMany: upsertManyBase,
    deleteOne: deleteOneBase,
    deleteMany: deleteManyBase,
  } = createMutationMethods({
    idOf,
    entitiesById,
    unitStateByKey,
    unitKeysById,
    readWriteStrategies,
    sweepExpiredOrphansIfNeeded,
    clearOrphanCleanupSchedule,
    syncOrphanSweepTimeoutByScan,
    notifyUnitsById,
    notifyUnitByKey,
    queueUnitsByKeys,
    queueUnitsByIds,
    queueUnitsById,
  });

  const draftsById = new Map<TId, TInput>();
  const draftOwnerIdentityKeyById = new Map<TId, string>();
  const draftModeById = new Map<TId, EntityDraftMode>();
  const draftLocalIdentityKeyById = new Map<TId, string>();
  const queuedDraftById = new Map<TId, TInput>();

  const resolveDraftMode = (options?: EntityDraftOptions): EntityDraftMode => {
    return options?.mode ?? DEFAULT_ENTITY_DRAFT_MODE;
  };

  const matchesDraftVisibilityOptions = (
    id: TId,
    options?: EntityDraftOptions,
  ): boolean => {
    if (!options) {
      return true;
    }

    if (options.mode) {
      const mode = draftModeById.get(id) ?? DEFAULT_ENTITY_DRAFT_MODE;
      if (mode !== options.mode) {
        return false;
      }
    }

    if (options.localIdentityKey) {
      const localIdentityKey = draftLocalIdentityKeyById.get(id);
      if (localIdentityKey !== options.localIdentityKey) {
        return false;
      }
    }

    return true;
  };

  const isDraftVisibleForReader = (
    id: TId,
    {
      identityKey,
      localIdentityKey,
    }: {
      identityKey?: string;
      localIdentityKey?: string;
    } = {},
  ): boolean => {
    if (!draftsById.has(id)) {
      return false;
    }

    const mode = draftModeById.get(id) ?? DEFAULT_ENTITY_DRAFT_MODE;
    if (mode === 'global') {
      return true;
    }

    if (!identityKey) {
      return false;
    }

    const ownerIdentityKey = draftOwnerIdentityKeyById.get(id);
    if (!ownerIdentityKey || ownerIdentityKey !== identityKey) {
      return false;
    }

    if (mode === 'identity') {
      return true;
    }

    if (!localIdentityKey) {
      return false;
    }

    return draftLocalIdentityKeyById.get(id) === localIdentityKey;
  };

  const readEntityValueForIdentityContext = (
    id: TId,
    {
      identityKey,
      localIdentityKey,
    }: {
      identityKey?: string;
      localIdentityKey?: string;
    } = {},
  ): TInput | undefined => {
    if (isDraftVisibleForReader(id, { identityKey, localIdentityKey })) {
      return draftsById.get(id);
    }

    return getBaseById(id);
  };

  const getDraftById = (id: TId): TInput | undefined => {
    return draftsById.get(id);
  };

  const getDraftStateById = (id: TId) => {
    const mode = draftModeById.get(id) ?? null;
    return {
      dirty: draftsById.has(id),
      ownerIdentityKey: draftOwnerIdentityKeyById.get(id) ?? null,
      hasQueuedChanges: queuedDraftById.has(id),
      mode,
      localIdentityKey: mode === 'local' ? draftLocalIdentityKeyById.get(id) ?? null : null,
    };
  };

  const getDraftIdsByIdentity = (
    identityKey: string,
    options?: EntityDraftOptions,
  ): readonly TId[] => {
    const ids: TId[] = [];
    draftOwnerIdentityKeyById.forEach((ownerIdentityKey, id) => {
      if (ownerIdentityKey !== identityKey) {
        return;
      }

      if (!matchesDraftVisibilityOptions(id, options)) {
        return;
      }

      ids.push(id);
    });
    return ids;
  };

  const hasDraftByIdentity = (
    identityKey: string,
    options?: EntityDraftOptions,
  ): boolean => {
    return getDraftIdsByIdentity(identityKey, options).length > 0;
  };

  const isOwnedByOtherIdentity = (
    id: TId,
    identityKey: string,
  ): boolean => {
    const ownerIdentityKey = draftOwnerIdentityKeyById.get(id);
    return Boolean(ownerIdentityKey && ownerIdentityKey !== identityKey);
  };

  const applyQueuedDraft = (id: TId): void => {
    const queuedDraft = queuedDraftById.get(id);
    if (!queuedDraft) {
      return;
    }

    queuedDraftById.delete(id);
    upsertOneBase(queuedDraft, {
      merge: true,
    });
  };

  const setDraft = (
    input: TInput,
    {
      identityKey,
      options,
    }: EntityDraftIdentityInput,
  ): TInput => {
    const id = idOf(input);
    if (isOwnedByOtherIdentity(id, identityKey)) {
      queuedDraftById.set(id, input);
      return input;
    }

    const mode = resolveDraftMode(options);
    draftOwnerIdentityKeyById.set(id, identityKey);
    draftModeById.set(id, mode);
    if (mode === 'local' && options?.localIdentityKey) {
      draftLocalIdentityKeyById.set(id, options.localIdentityKey);
    } else {
      draftLocalIdentityKeyById.delete(id);
    }
    draftsById.set(id, input);
    notifyUnitsById(id);
    return input;
  };

  const setDraftMany = (
    input: readonly TInput[],
    identity: EntityDraftIdentityInput,
  ): readonly TInput[] => {
    input.forEach((entry) => {
      setDraft(entry, identity);
    });
    return input;
  };

  const clearDraft = (
    id: TId,
    {
      identityKey,
    }: EntityDraftIdentityInput,
  ): boolean => {
    if (isOwnedByOtherIdentity(id, identityKey)) {
      return false;
    }

    const existed = draftsById.delete(id);
    if (!existed) {
      return false;
    }

    draftOwnerIdentityKeyById.delete(id);
    draftModeById.delete(id);
    draftLocalIdentityKeyById.delete(id);
    notifyUnitsById(id);
    applyQueuedDraft(id);
    return true;
  };

  const clearDraftMany = (
    ids: readonly TId[],
    identity: EntityDraftIdentityInput,
  ): readonly TId[] => {
    return ids.filter((id) => clearDraft(id, identity));
  };

  const clearDraftByIdentity = (
    identityKey: string,
    options?: EntityDraftOptions,
  ): readonly TId[] => {
    const ownedIds = getDraftIdsByIdentity(identityKey, options);
    return clearDraftMany(ownedIds, { identityKey, options });
  };

  const commitDraft = (
    id: TId,
    {
      identityKey,
      options,
    }: EntityDraftCommitInput,
  ): TInput | undefined => {
    if (isOwnedByOtherIdentity(id, identityKey)) {
      return undefined;
    }

    const draftValue = draftsById.get(id);
    if (!draftValue) {
      return undefined;
    }

    applyQueuedDraft(id);
    const persisted = upsertOneBase(draftValue, options ?? {
      merge: true,
    });
    draftsById.delete(id);
    draftOwnerIdentityKeyById.delete(id);
    draftModeById.delete(id);
    draftLocalIdentityKeyById.delete(id);
    notifyUnitsById(id);
    return persisted;
  };

  const commitDraftMany = (
    ids: readonly TId[],
    identity: EntityDraftCommitInput,
  ): readonly TInput[] => {
    return ids.reduce<readonly TInput[]>((previous, id) => {
      const committed = commitDraft(id, identity);
      if (!committed) {
        return previous;
      }

      return [...previous, committed];
    }, []);
  };

  const getById = (id: TId): TInput | undefined => {
    return readEntityValueForIdentityContext(id);
  };

  const getByIdForIdentity = (
    id: TId,
    identityKey: string,
  ): TInput | undefined => {
    return readEntityValueForIdentityContext(id, { identityKey });
  };

  const getByIdForIdentityContext = ({
    id,
    identityKey,
    localIdentityKey,
  }: EntityReadByIdentityContextInput<TId>): TInput | undefined => {
    return readEntityValueForIdentityContext(id, {
      identityKey,
      localIdentityKey,
    });
  };

  const deleteOne = (id: TId): boolean => {
    const removed = deleteOneBase(id);
    const hadDraft = draftsById.delete(id);
    const hadQueuedDraft = queuedDraftById.delete(id);
    const hadOwner = draftOwnerIdentityKeyById.delete(id);
    const hadMode = draftModeById.delete(id);
    const hadLocalIdentity = draftLocalIdentityKeyById.delete(id);
    if (hadDraft || hadQueuedDraft || hadOwner || hadMode || hadLocalIdentity) {
      notifyUnitsById(id);
    }

    return removed;
  };

  const deleteMany = (ids: readonly TId[]): readonly TId[] => {
    const removedIds = deleteManyBase(ids);
    const affectedIds = ids.filter((id) => {
      const hadDraft = draftsById.delete(id);
      const hadQueuedDraft = queuedDraftById.delete(id);
      const hadOwner = draftOwnerIdentityKeyById.delete(id);
      const hadMode = draftModeById.delete(id);
      const hadLocalIdentity = draftLocalIdentityKeyById.delete(id);
      return hadDraft || hadQueuedDraft || hadOwner || hadMode || hadLocalIdentity;
    });

    affectedIds.forEach((id) => {
      notifyUnitsById(id);
    });

    return removedIds;
  };

  const upsertOne = (
    input: TInput,
    options?: UpsertOptions,
  ): TInput => {
    return upsertOneBase(input, options);
  };

  const upsertMany = (
    input: readonly TInput[],
    options?: UpsertOptions,
  ): readonly TInput[] => {
    return upsertManyBase(input, options);
  };

  return {
    key,
    ttl,
    destroyDelay,
    cache,
    readWrite: defaultReadWriteStrategy,
    idOf,
    entitiesById,
    getById,
    getByIdForIdentity,
    getByIdForIdentityContext,
    registerUnit,
    setUnitMembership,
    clearUnitMembership,
    upsertOne,
    upsertMany,
    deleteOne,
    deleteMany,
    getDraftById,
    getDraftStateById,
    getDraftIdsByIdentity,
    hasDraftByIdentity,
    setDraft,
    setDraftMany,
    clearDraft,
    clearDraftMany,
    clearDraftByIdentity,
    commitDraft,
    commitDraftMany,
  };
};
