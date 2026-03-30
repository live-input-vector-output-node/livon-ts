import { createDeleteMethods } from './createDeleteMethods.js';
import { createUpsertMethods } from './createUpsertMethods.js';
import type {
  EntityByIdMap,
  EntityId,
  EntityUnitState,
  UpsertOptions,
} from './types.js';
import type { EntityReadWriteStrategies } from './createEntityReadWriteStrategies.js';
import type { ClearOrphanCleanupScheduleResult } from './createOrphanMethods.js';

interface CreateMutationMethodsInput<
  TInput extends object,
  TId extends EntityId,
> {
  idOf: (input: TInput) => TId;
  entitiesById: EntityByIdMap<TInput, TId>;
  unitStateByKey: Map<string, EntityUnitState<TId>>;
  unitKeysById: Map<TId, Set<string>>;
  readWriteStrategies: EntityReadWriteStrategies;
  sweepExpiredOrphansIfNeeded: () => void;
  clearOrphanCleanupSchedule: (id: TId) => ClearOrphanCleanupScheduleResult;
  syncOrphanSweepTimeoutByScan: () => void;
  notifyUnitsById: (id: TId) => void;
  notifyUnitByKey: (key: string) => void;
  queueUnitsByKeys: (keys: Set<string>) => void;
  queueUnitsByIds: (ids: Set<TId>) => void;
  queueUnitsById: (id: TId) => void;
}

export interface MutationMethods<
  TInput extends object,
  TId extends EntityId,
> {
  upsertOne: (input: TInput, options?: UpsertOptions) => TInput;
  upsertMany: (input: readonly TInput[], options?: UpsertOptions) => readonly TInput[];
  deleteOne: (id: TId) => boolean;
  deleteMany: (ids: readonly TId[]) => readonly TId[];
}

export const createMutationMethods = <
  TInput extends object,
  TId extends EntityId,
>({
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
}: CreateMutationMethodsInput<TInput, TId>): MutationMethods<TInput, TId> => {
  const {
    upsertOne,
    upsertMany,
  } = createUpsertMethods({
    idOf,
    entitiesById,
    readWriteStrategies,
    sweepExpiredOrphansIfNeeded,
    notifyUnitsById,
    queueUnitsByIds,
    queueUnitsById,
  });

  const {
    deleteOne,
    deleteMany,
  } = createDeleteMethods({
    entitiesById,
    unitStateByKey,
    unitKeysById,
    readWriteStrategies,
    sweepExpiredOrphansIfNeeded,
    clearOrphanCleanupSchedule,
    syncOrphanSweepTimeoutByScan,
    notifyUnitByKey,
    queueUnitsByKeys,
  });

  return {
    upsertOne,
    upsertMany,
    deleteOne,
    deleteMany,
  };
};
