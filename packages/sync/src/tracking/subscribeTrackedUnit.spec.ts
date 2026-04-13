import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readTrackedUnitSnapshot } from './snapshotStore.js';
import { subscribeTrackedUnit } from './subscribeTrackedUnit.js';
import type { TrackedUnit, UnitSnapshot } from './types.js';

interface User {
  id: string;
}

describe('subscribeTrackedUnit()', () => {
  let getSnapshotMock = vi.fn();
  let removeSubscriptionMock = vi.fn();
  let unitSnapshotListener: ((snapshot: UnitSnapshot<User | null, string | null>) => void) | null = null;
  let unit: TrackedUnit<User | null, string>;

  beforeEach(() => {
    const createInitialSnapshot = (): UnitSnapshot<User | null, string | null> => {
      return {
        value: null,
        status: 'idle',
        meta: null,
        context: null,
      };
    };
    getSnapshotMock = vi.fn(createInitialSnapshot);
    removeSubscriptionMock = vi.fn();
    unitSnapshotListener = null;

    unit = {
      getSnapshot: getSnapshotMock,
      subscribe: (listener) => {
        unitSnapshotListener = listener;
        return removeSubscriptionMock;
      },
    };
  });

  describe('happy', () => {
    it('should skip onStoreChange when emitted snapshot does not change tracked fields', () => {
      readTrackedUnitSnapshot(unit);
      const onStoreChange = vi.fn();

      subscribeTrackedUnit({
        unit,
        onStoreChange,
      });

      unitSnapshotListener?.({
        value: null,
        status: 'idle',
        meta: null,
        context: null,
      });

      expect(onStoreChange).toHaveBeenCalledTimes(0);
    });

    it('should call onStoreChange when emitted snapshot changes tracked fields', () => {
      readTrackedUnitSnapshot(unit);
      const onStoreChange = vi.fn();

      subscribeTrackedUnit({
        unit,
        onStoreChange,
      });

      unitSnapshotListener?.({
        value: { id: 'user-1' },
        status: 'success',
        meta: 'next-meta',
        context: { stage: 'done' },
      });

      expect(onStoreChange).toHaveBeenCalledTimes(1);
    });

    it('should keep cached snapshot reference for equal updates', () => {
      const firstSnapshot = readTrackedUnitSnapshot(unit);
      const onStoreChange = vi.fn();
      subscribeTrackedUnit({
        unit,
        onStoreChange,
      });

      unitSnapshotListener?.({
        value: null,
        status: 'idle',
        meta: null,
        context: null,
      });

      const secondSnapshot = readTrackedUnitSnapshot(unit);

      expect(firstSnapshot).toBe(secondSnapshot);
      expect(onStoreChange).toHaveBeenCalledTimes(0);
    });

    it('should skip onStoreChange for shallow-equal object payload updates', () => {
      readTrackedUnitSnapshot(unit);
      const onStoreChange = vi.fn();
      subscribeTrackedUnit({
        unit,
        onStoreChange,
      });

      unitSnapshotListener?.({
        value: {
          id: 'user-1',
        },
        status: 'success',
        meta: null,
        context: null,
      });
      onStoreChange.mockClear();

      unitSnapshotListener?.({
        value: {
          id: 'user-1',
        },
        status: 'success',
        meta: null,
        context: null,
      });

      expect(onStoreChange).toHaveBeenCalledTimes(0);
    });
  });
});
