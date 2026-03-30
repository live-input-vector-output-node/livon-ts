import { runEntityWriteStrategy } from '../utils/readWriteStrategy.js';
import type {
  EntityByIdMap,
  EntityId,
  EntityUnitState,
} from './types.js';
import type { EntityReadWriteStrategies } from './createEntityReadWriteStrategies.js';
import type { ClearOrphanCleanupScheduleResult } from './createOrphanMethods.js';

const NOTIFY_BATCH_THRESHOLD = 32;

interface CreateDeleteMethodsInput<
  TInput extends object,
  TId extends EntityId,
> {
  entitiesById: EntityByIdMap<TInput, TId>;
  unitStateByKey: Map<string, EntityUnitState<TId>>;
  unitKeysById: Map<TId, Set<string>>;
  readWriteStrategies: EntityReadWriteStrategies;
  sweepExpiredOrphansIfNeeded: () => void;
  clearOrphanCleanupSchedule: (id: TId) => ClearOrphanCleanupScheduleResult;
  syncOrphanSweepTimeoutByScan: () => void;
  notifyUnitByKey: (key: string) => void;
  queueUnitsByKeys: (keys: Set<string>) => void;
}

export interface DeleteMethods<TId extends EntityId> {
  deleteOne: (id: TId) => boolean;
  deleteMany: (ids: readonly TId[]) => readonly TId[];
}

export const createDeleteMethods = <
  TInput extends object,
  TId extends EntityId,
>({
  entitiesById,
  unitStateByKey,
  unitKeysById,
  readWriteStrategies,
  sweepExpiredOrphansIfNeeded,
  clearOrphanCleanupSchedule,
  syncOrphanSweepTimeoutByScan,
  notifyUnitByKey,
  queueUnitsByKeys,
}: CreateDeleteMethodsInput<TInput, TId>): DeleteMethods<TId> => {
  const deleteOne = (id: TId): boolean => {
    sweepExpiredOrphansIfNeeded();
    const { removedNextScheduled } = clearOrphanCleanupSchedule(id);
    const existed = entitiesById.delete(id);
    if (removedNextScheduled) {
      syncOrphanSweepTimeoutByScan();
    }

    if (!existed) {
      return false;
    }

    const affectedKeys = unitKeysById.get(id);
    affectedKeys?.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      if (!unitState) {
        return;
      }

      unitState.membershipIds.delete(id);
    });

    unitKeysById.delete(id);

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateOne,
      changedIdCount: 1,
      affectedKeyCount: affectedKeys?.size ?? 0,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        affectedKeys?.forEach((key) => {
          notifyUnitByKey(key);
        });
      },
      runBatched: () => {
        if (!affectedKeys) {
          return;
        }

        queueUnitsByKeys(affectedKeys);
      },
    });

    return true;
  };

  const deleteMany = (ids: readonly TId[]): readonly TId[] => {
    sweepExpiredOrphansIfNeeded();
    const removedIds: TId[] = [];
    const affectedKeys = new Set<string>();
    let removedNextScheduledOrphan = false;

    ids.forEach((id) => {
      const { removedNextScheduled } = clearOrphanCleanupSchedule(id);
      if (removedNextScheduled) {
        removedNextScheduledOrphan = true;
      }

      const existed = entitiesById.delete(id);
      if (!existed) {
        return;
      }

      removedIds.push(id);
      const unitKeys = unitKeysById.get(id);
      if (!unitKeys) {
        return;
      }

      unitKeys.forEach((key) => {
        affectedKeys.add(key);
        const unitState = unitStateByKey.get(key);
        if (!unitState) {
          return;
        }

        unitState.membershipIds.delete(id);
      });

      unitKeysById.delete(id);
    });

    if (removedNextScheduledOrphan) {
      syncOrphanSweepTimeoutByScan();
    }

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateMany,
      changedIdCount: removedIds.length,
      affectedKeyCount: affectedKeys.size,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        affectedKeys.forEach((key) => {
          notifyUnitByKey(key);
        });
      },
      runBatched: () => {
        queueUnitsByKeys(affectedKeys);
      },
    });

    return removedIds;
  };

  return {
    deleteOne,
    deleteMany,
  };
};
