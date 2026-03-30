import { runEntityWriteStrategy } from '../utils/readWriteStrategy.js';
import { mergeEntity } from './mergeEntity.js';
import type {
  EntityByIdMap,
  EntityId,
  UpsertOptions,
} from './types.js';
import type { EntityReadWriteStrategies } from './createEntityReadWriteStrategies.js';

const NOTIFY_BATCH_THRESHOLD = 32;

interface UpsertManyAccumulator<
  TInput extends object,
  TId extends EntityId,
> {
  changedIds: Set<TId>;
  hasDuplicates: boolean;
  mergedValues: TInput[];
}

interface CreateUpsertMethodsInput<
  TInput extends object,
  TId extends EntityId,
> {
  idOf: (input: TInput) => TId;
  entitiesById: EntityByIdMap<TInput, TId>;
  readWriteStrategies: EntityReadWriteStrategies;
  sweepExpiredOrphansIfNeeded: () => void;
  notifyUnitsById: (id: TId) => void;
  queueUnitsByIds: (ids: Set<TId>) => void;
  queueUnitsById: (id: TId) => void;
}

export interface UpsertMethods<
  TInput extends object,
> {
  upsertOne: (input: TInput, options?: UpsertOptions) => TInput;
  upsertMany: (input: readonly TInput[], options?: UpsertOptions) => readonly TInput[];
}

const createUpsertManyAccumulator = <
  TInput extends object,
  TId extends EntityId,
>(): UpsertManyAccumulator<TInput, TId> => {
  return {
    changedIds: new Set<TId>(),
    hasDuplicates: false,
    mergedValues: [],
  };
};

export const createUpsertMethods = <
  TInput extends object,
  TId extends EntityId,
>({
  idOf,
  entitiesById,
  readWriteStrategies,
  sweepExpiredOrphansIfNeeded,
  notifyUnitsById,
  queueUnitsByIds,
  queueUnitsById,
}: CreateUpsertMethodsInput<TInput, TId>): UpsertMethods<TInput> => {
  const upsertOne = (input: TInput, options?: UpsertOptions): TInput => {
    sweepExpiredOrphansIfNeeded();
    const id = idOf(input);
    const currentEntity = entitiesById.get(id);
    const shouldMerge = Boolean(options?.merge);
    const mergedInput = mergeEntity({
      current: currentEntity,
      next: input,
      shouldMerge,
    });

    if (Object.is(currentEntity, mergedInput)) {
      return mergedInput;
    }

    entitiesById.set(id, mergedInput);
    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateOne,
      changedIdCount: 1,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        notifyUnitsById(id);
      },
      runBatched: () => {
        queueUnitsById(id);
      },
    });

    return mergedInput;
  };

  const upsertMany = (
    input: readonly TInput[],
    options?: UpsertOptions,
  ): readonly TInput[] => {
    sweepExpiredOrphansIfNeeded();
    const shouldMerge = Boolean(options?.merge);

    if (!shouldMerge && entitiesById.size === 0) {
      const {
        changedIds,
        hasDuplicates,
        mergedValues,
      } = input.reduce<UpsertManyAccumulator<TInput, TId>>((accumulator, entry) => {
        const id = idOf(entry);
        const previousSize = accumulator.changedIds.size;
        accumulator.changedIds.add(id);
        if (accumulator.changedIds.size === previousSize) {
          accumulator.hasDuplicates = true;
        }

        entitiesById.set(id, entry);
        accumulator.mergedValues.push(entry);
        return accumulator;
      }, createUpsertManyAccumulator<TInput, TId>());

      runEntityWriteStrategy({
        strategy: readWriteStrategies.updateMany,
        changedIdCount: changedIds.size,
        hasDuplicates,
        batchThreshold: NOTIFY_BATCH_THRESHOLD,
        runImmediate: () => {
          changedIds.forEach((changedId) => {
            notifyUnitsById(changedId);
          });
        },
        runBatched: () => {
          queueUnitsByIds(changedIds);
        },
      });

      return mergedValues;
    }

    const {
      changedIds,
      hasDuplicates,
      mergedValues,
    } = input.reduce<UpsertManyAccumulator<TInput, TId>>((accumulator, entry) => {
      const id = idOf(entry);
      const currentEntity = entitiesById.get(id);
      const mergedInput = mergeEntity({
        current: currentEntity,
        next: entry,
        shouldMerge,
      });

      const changed = !Object.is(currentEntity, mergedInput);
      if (changed) {
        entitiesById.set(id, mergedInput);
        const changedIdCountBefore = accumulator.changedIds.size;
        accumulator.changedIds.add(id);
        if (accumulator.changedIds.size === changedIdCountBefore) {
          accumulator.hasDuplicates = true;
        }
      }

      accumulator.mergedValues.push(mergedInput);
      return accumulator;
    }, createUpsertManyAccumulator<TInput, TId>());

    runEntityWriteStrategy({
      strategy: readWriteStrategies.updateMany,
      changedIdCount: changedIds.size,
      hasDuplicates,
      batchThreshold: NOTIFY_BATCH_THRESHOLD,
      runImmediate: () => {
        changedIds.forEach((id) => {
          notifyUnitsById(id);
        });
      },
      runBatched: () => {
        queueUnitsByIds(changedIds);
      },
    });

    return mergedValues;
  };

  return {
    upsertOne,
    upsertMany,
  };
};
