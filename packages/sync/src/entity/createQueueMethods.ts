import { defaultRuntimeQueue } from '../runtimeQueue/index.js';
import type {
  EntityId,
  EntityUnitState,
} from './types.js';

interface CreateQueueMethodsInput<TId extends EntityId> {
  unitStateByKey: Map<string, EntityUnitState<TId>>;
  unitKeysById: Map<TId, Set<string>>;
  dirtyUnitKeys: Set<string>;
  dirtyUnitsQueueKey: string;
}

export interface QueueMethods<TId extends EntityId> {
  notifyUnitsById: (id: TId) => void;
  notifyUnitByKey: (key: string) => void;
  queueUnitsByKeys: (keys: Set<string>) => void;
  queueUnitsByIds: (ids: Set<TId>) => void;
  queueUnitsById: (id: TId) => void;
}

export const createQueueMethods = <TId extends EntityId>({
  unitStateByKey,
  unitKeysById,
  dirtyUnitKeys,
  dirtyUnitsQueueKey,
}: CreateQueueMethodsInput<TId>): QueueMethods<TId> => {
  const notifyUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);

    if (!unitKeys) {
      return;
    }

    unitKeys.forEach((key) => {
      const unitState = unitStateByKey.get(key);
      unitState?.onChange();
    });
  };

  const notifyUnitByKey = (key: string): void => {
    const unitState = unitStateByKey.get(key);
    unitState?.onChange();
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

  const queueUnitsByKeys = (keys: Set<string>): void => {
    if (keys.size === 0) {
      return;
    }

    keys.forEach((key) => {
      dirtyUnitKeys.add(key);
    });

    scheduleDirtyUnitsFlush();
  };

  const queueUnitsByIds = (ids: Set<TId>): void => {
    if (unitKeysById.size === 0 || ids.size === 0) {
      return;
    }

    const keys = new Set<string>();
    ids.forEach((id) => {
      const unitKeys = unitKeysById.get(id);
      if (!unitKeys) {
        return;
      }

      unitKeys.forEach((key) => {
        keys.add(key);
      });
    });

    queueUnitsByKeys(keys);
  };

  const queueUnitsById = (id: TId): void => {
    const unitKeys = unitKeysById.get(id);
    if (!unitKeys || unitKeys.size === 0) {
      return;
    }

    queueUnitsByKeys(unitKeys);
  };

  return {
    notifyUnitsById,
    notifyUnitByKey,
    queueUnitsByKeys,
    queueUnitsByIds,
    queueUnitsById,
  };
};
