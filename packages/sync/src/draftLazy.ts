import type {
  Entity,
  EntityDraftOptions,
  EntityId,
} from './entity.js';
import type {
  SourceUnit,
} from './source/index.js';
import { source as lazySource } from './sourceLazy.js';
import {
  createSerializedKeyCache as createIdentityKeyCache,
} from './utils/index.js';
import type {
  EntityValueOfStore,
  UnitDataByEntityMode,
  UnitEntityMode,
} from './utils/index.js';
import { createDraftAwareEntity } from './draft/createDraftAwareEntity.js';
import { resolveDraftOptions } from './draft/resolveDraftOptions.js';
import { createDraftSourceConfig } from './draft/createDraftSourceConfig.js';
import type {
  Draft,
  DraftBuilder,
  DraftBuilderInput,
  DraftByEntityModeBuilder,
  DraftConfig,
  DraftSetInput,
  DraftSnapshot,
  DraftSnapshotListener,
  DraftStatus,
  DraftUnit,
} from './draft/index.js';

interface RecordLike {
  [key: string]: unknown;
}

const isRecordLike = (value: unknown): value is RecordLike => {
  return typeof value === 'object' && value !== null;
};

const isEntityId = (value: unknown): value is EntityId => {
  return typeof value === 'string' || typeof value === 'number';
};

const isSameEntityIdList = (
  left: readonly EntityId[],
  right: readonly EntityId[],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((id, index) => Object.is(id, right[index]));
};

const isSameReferenceList = <TValue>(
  left: readonly TValue[],
  right: readonly TValue[],
): boolean => {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => Object.is(value, right[index]));
};

interface ResolveManyDraftValueInput<TData, TEntity extends object> {
  identityKey: string;
  previousValue: unknown;
  sourceValue: TData;
  trackedIds: readonly EntityId[];
  readEntityValueForDraftIdentity: (id: EntityId, identityKey: string) => TEntity | undefined;
}

interface ResolveSingleDraftValueInput<TData, TEntity extends object> {
  identityKey: string;
  sourceValue: TData;
  trackedIds: readonly EntityId[];
  readEntityValueForDraftIdentity: (id: EntityId, identityKey: string) => TEntity | undefined;
}

const resolveManyDraftValue = <TData, TEntity extends object>({
  identityKey,
  previousValue,
  sourceValue,
  trackedIds,
  readEntityValueForDraftIdentity,
}: ResolveManyDraftValueInput<TData, TEntity>): TData | readonly TEntity[] => {
  if (trackedIds.length === 0) {
    return sourceValue;
  }

  const resolvedValues = trackedIds
    .map((id) => readEntityValueForDraftIdentity(id, identityKey))
    .filter((entry): entry is TEntity => entry !== undefined);
  if (resolvedValues.length === 0) {
    return sourceValue;
  }

  const previousManyValue = Array.isArray(previousValue) ? previousValue : null;
  if (
    previousManyValue
    && isSameReferenceList(previousManyValue, resolvedValues)
  ) {
    return previousManyValue;
  }

  return resolvedValues;
};

const resolveSingleDraftValue = <TData, TEntity extends object>({
  identityKey,
  sourceValue,
  trackedIds,
  readEntityValueForDraftIdentity,
}: ResolveSingleDraftValueInput<TData, TEntity>): TData | TEntity => {
  if (trackedIds.length === 0) {
    return sourceValue;
  }

  const firstTrackedId = trackedIds[0];
  if (firstTrackedId === undefined) {
    return sourceValue;
  }

  return readEntityValueForDraftIdentity(firstTrackedId, identityKey) ?? sourceValue;
};

const resolveLooseEntityId = (
  value: unknown,
): EntityId | undefined => {
  if (!isRecordLike(value)) {
    return undefined;
  }

  const id = value.id;
  if (!isEntityId(id)) {
    return undefined;
  }

  return id;
};


const mergeRecordLikeIntoEntity = <TEntity extends object>(
  base: TEntity,
  patch: RecordLike,
): TEntity => {
  const next = { ...base };
  Object.keys(patch).forEach((key) => {
    Reflect.set(next, key, patch[key]);
  });
  return next;
};
const isDraftSetUpdater = <
  TData,
  TEntity extends object,
>(
  input: DraftSetInput<TData, TEntity>,
): input is (previous: TData) => TData extends readonly TEntity[]
  ? readonly (TEntity | Partial<TEntity>)[]
  : TEntity | Partial<TEntity> => {
  return typeof input === 'function';
};

export const draft: DraftBuilder = <
  TEntityStore extends Entity<object, EntityId>,
  TMode extends UnitEntityMode,
>({
  entity,
  mode,
}: DraftBuilderInput<TEntityStore, TMode>): DraftByEntityModeBuilder<TEntityStore, TMode> => {
  type TEntity = EntityValueOfStore<TEntityStore>;
  type TData = UnitDataByEntityMode<TEntity, TMode>;

  const {
    entity: draftAwareEntity,
    methods,
  } = createDraftAwareEntity<TEntity>({
    entity,
  });
  const identityKeyCache = createIdentityKeyCache({
    mode: 'identity-unit',
  });

  const sourceByEntityMode = lazySource<Entity<TEntity, EntityId>, TMode>({
    entity: draftAwareEntity,
    mode,
  });

  const draftByEntityMode: DraftByEntityModeBuilder<TEntityStore, TMode> = <
    TIdentity extends object | undefined,
    TMeta,
  >(
    config: DraftConfig<
      TIdentity,
      TEntity,
      TMode,
      TMeta
    >,
  ): Draft<
    TIdentity,
    TData,
    TMeta,
    TEntity
  > => {
    const sourceUnitByIdentityKey = new Map<string, SourceUnit<TIdentity, undefined, TData, TMeta>>();
    const trackedIdsByIdentityKey = new Map<string, readonly EntityId[]>();
    const draftMode = config.mode ?? 'global';
    const draftOptionsByIdentityKey = new Map<string, EntityDraftOptions>();

    const resolveDraftOptionsByIdentityKey = (identityKey: string): EntityDraftOptions => {
      const cachedOptions = draftOptionsByIdentityKey.get(identityKey);
      if (cachedOptions) {
        return cachedOptions;
      }

      const createdOptions = resolveDraftOptions({
        entity: draftAwareEntity,
        entityMode: mode,
        config,
        draftMode,
        identityKey,
      });
      draftOptionsByIdentityKey.set(identityKey, createdOptions);
      return createdOptions;
    };

    const readEntityValueForDraftIdentity = (
      id: EntityId,
      identityKey: string,
    ): TEntity | undefined => {
      const draftOptions = resolveDraftOptionsByIdentityKey(identityKey);
      if (draftOptions.mode === 'local' && draftOptions.localIdentityKey) {
        return draftAwareEntity.getByIdForIdentityContext({
          id,
          identityKey,
          localIdentityKey: draftOptions.localIdentityKey,
        });
      }

      return draftAwareEntity.getByIdForIdentity(id, identityKey);
    };

    const resolveManySet = ({
      draftOptions,
      identityKey,
      resolvedInput,
      sourceValue,
    }: {
      draftOptions: EntityDraftOptions | undefined;
      identityKey: string;
      resolvedInput: readonly unknown[];
      sourceValue: unknown;
    }): void => {
      const currentValues = Array.isArray(sourceValue) ? sourceValue : [];
      const resolvedIds: EntityId[] = [];
      resolvedInput.forEach((entry, index) => {
        if (!isRecordLike(entry)) {
          return;
        }

        const currentValue = currentValues[index];
        const resolvedId = resolveLooseEntityId(entry) ?? (currentValue ? entity.idOf(currentValue) : undefined);
        const base = resolvedId === undefined
          ? undefined
          : readEntityValueForDraftIdentity(resolvedId, identityKey) ?? currentValue;
        if (!base || resolvedId === undefined) {
          return;
        }

        methods.setDraft(mergeRecordLikeIntoEntity(base, entry), {
          identityKey,
          options: draftOptions,
        });
        resolvedIds.push(resolvedId);
      });
      if (resolvedIds.length > 0) {
        trackedIdsByIdentityKey.set(identityKey, resolvedIds);
      }
    };

    const resolveSingleSet = ({
      draftOptions,
      identityKey,
      resolvedInput,
      sourceValue,
    }: {
      draftOptions: EntityDraftOptions | undefined;
      identityKey: string;
      resolvedInput: RecordLike;
      sourceValue: unknown;
    }): void => {
      const currentId = Array.isArray(sourceValue) ? undefined : resolveLooseEntityId(sourceValue);
      const resolvedId = resolveLooseEntityId(resolvedInput) ?? currentId;
      const base = resolvedId === undefined ? undefined : readEntityValueForDraftIdentity(resolvedId, identityKey);
      if (!base || resolvedId === undefined) {
        return;
      }

      methods.setDraft(mergeRecordLikeIntoEntity(base, resolvedInput), {
        identityKey,
        options: draftOptions,
      });
      trackedIdsByIdentityKey.set(identityKey, [resolvedId]);
    };

    const resolveSet = (
      identity: TIdentity,
      input: DraftSetInput<TData, TEntity>,
    ): void => {
      const identityKey = identityKeyCache.getOrCreateKey(identity);
      const draftOptions = resolveDraftOptionsByIdentityKey(identityKey);
      const sourceUnit = sourceUnitByIdentityKey.get(identityKey);
      if (!sourceUnit && isDraftSetUpdater(input)) {
        return;
      }

      const sourceSnapshot = sourceUnit?.getSnapshot();
      const isUpdaterInput = isDraftSetUpdater(input);
      const resolvedInput = isUpdaterInput
        ? (sourceSnapshot ? input(sourceSnapshot.value) : undefined)
        : input;
      if (resolvedInput === undefined) {
        return;
      }

      if (mode === 'many') {
        if (!Array.isArray(resolvedInput)) {
          return;
        }

        resolveManySet({
          draftOptions,
          identityKey,
          resolvedInput,
          sourceValue: sourceSnapshot?.value,
        });
        return;
      }

      if (!isRecordLike(resolvedInput) || Array.isArray(resolvedInput)) {
        return;
      }

      resolveSingleSet({
        draftOptions,
        identityKey,
        resolvedInput,
        sourceValue: sourceSnapshot?.value,
      });
    };

    const resolveClear = (
      identity: TIdentity,
    ): void => {
      const identityKey = identityKeyCache.getOrCreateKey(identity);
      methods.clearDraftByIdentity(
        identityKey,
        resolveDraftOptionsByIdentityKey(identityKey),
      );
    };

    const sourceFactory = sourceByEntityMode<TIdentity, undefined, TMeta>(
      createDraftSourceConfig({
        config,
        resolveClear,
      }),
    );

    const unitBySourceUnit = new WeakMap<
      SourceUnit<TIdentity, undefined, TData, TMeta>,
      DraftUnit<TIdentity, TData, TMeta, TEntity>
    >();

    const draftFactory: Draft<TIdentity, TData, TMeta, TEntity> = (identity) => {
      const sourceUnit = sourceFactory(identity);
      const cachedUnit = unitBySourceUnit.get(sourceUnit);
      if (cachedUnit) {
        return cachedUnit;
      }

      const identityKey = identityKeyCache.getOrCreateKey(identity);
      sourceUnitByIdentityKey.set(identityKey, sourceUnit);

      let notifyListeners = (): void => undefined;
      const set = (input: DraftSetInput<TData, TEntity>): void => {
        resolveSet(identity, input);
        notifyListeners();
      };

      const clear = (): void => {
        resolveClear(identity);
        notifyListeners();
      };
      const reset = (): void => {
        clear();
      };

      let snapshotCache: DraftSnapshot<TIdentity, TData, TMeta, TEntity> | null = null;
      let sourceSnapshotCache = sourceUnit.getSnapshot();
      let draftStatus: DraftStatus = methods.hasDraftByIdentity(
        identityKey,
        resolveDraftOptionsByIdentityKey(identityKey),
      )
        ? 'dirty'
        : 'clear';
      let trackedIdsCache: readonly EntityId[] = trackedIdsByIdentityKey.get(identityKey) ?? [];
      const listeners = new Set<DraftSnapshotListener<TIdentity, TData, TMeta, TEntity>>();
      let removeSourceListener: (() => void) | null = null;

      const getSnapshot = (): DraftSnapshot<TIdentity, TData, TMeta, TEntity> => {
        const sourceSnapshot = sourceUnit.getSnapshot();
        const draftOptions = resolveDraftOptionsByIdentityKey(identityKey);
        const activeDraftIds = methods.getDraftIdsByIdentity(
          identityKey,
          draftOptions,
        );
        const trackedIds = activeDraftIds.length > 0
          ? activeDraftIds
          : (trackedIdsByIdentityKey.get(identityKey) ?? []);
        const nextDraftStatus: DraftStatus = activeDraftIds.length > 0
          ? 'dirty'
          : 'clear';
        const nextValue = mode === 'many'
          ? resolveManyDraftValue({
            identityKey,
            previousValue: snapshotCache?.value,
            sourceValue: sourceSnapshot.value,
            trackedIds,
            readEntityValueForDraftIdentity,
          })
          : resolveSingleDraftValue({
            identityKey,
            sourceValue: sourceSnapshot.value,
            trackedIds,
            readEntityValueForDraftIdentity,
          });

        if (
          snapshotCache
          && Object.is(sourceSnapshotCache, sourceSnapshot)
          && draftStatus === nextDraftStatus
          && isSameEntityIdList(trackedIdsCache, trackedIds)
          && Object.is(snapshotCache.value, nextValue)
        ) {
          return snapshotCache;
        }

        sourceSnapshotCache = sourceSnapshot;
        draftStatus = nextDraftStatus;
        trackedIdsCache = [...trackedIds];

        snapshotCache = {
          value: nextValue as TData,
          status: draftStatus,
          meta: sourceSnapshot.meta,
          context: sourceSnapshot.context,
          identity,
          set,
          clear,
          reset,
        };

        return snapshotCache;
      };

      notifyListeners = (): void => {
        if (listeners.size === 0) {
          return;
        }

        const snapshot = getSnapshot();
        listeners.forEach((listener) => {
          listener(snapshot);
        });
      };

      const ensureSourceListener = (): void => {
        if (removeSourceListener || listeners.size === 0) {
          return;
        }

        const remove = sourceUnit.subscribe(() => {
          notifyListeners();
        });
        removeSourceListener = remove ?? null;
      };

      const releaseSourceListener = (): void => {
        if (!removeSourceListener) {
          return;
        }

        removeSourceListener();
        removeSourceListener = null;
      };

      const subscribe: DraftUnit<TIdentity, TData, TMeta, TEntity>['subscribe'] = (
        listener,
      ) => {
        listeners.add(listener);
        ensureSourceListener();

        return () => {
          listeners.delete(listener);
          if (listeners.size === 0) {
            releaseSourceListener();
          }
        };
      };

      const draftUnit: DraftUnit<TIdentity, TData, TMeta, TEntity> = {
        getSnapshot,
        subscribe,
      };

      unitBySourceUnit.set(sourceUnit, draftUnit);
      return draftUnit;
    };

    return draftFactory;
  };

  return draftByEntityMode;
};

export type {
  Draft,
  DraftBuilderInput,
  DraftByEntityModeBuilder,
  DraftCleanup,
  DraftConfig,
  DraftContext,
  DraftMetaOfConfig,
  DraftMode,
  DraftSetInput,
  DraftSetUpdater,
  DraftSetValue,
  DraftSnapshot,
  DraftSnapshotListener,
  DraftState,
  DraftStatus,
  DraftUnit,
} from './draft/index.js';
