import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import type { TrackedUnit, UnitSnapshot } from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';

type TestSnapshot = UnitSnapshot<number, string | null>;

describe('useLivonSelection()', () => {
  let currentSnapshot: TestSnapshot;
  let listeners: Set<(snapshot: TestSnapshot) => void>;
  let unit: TrackedUnit<number, string>;

  beforeEach(() => {
    currentSnapshot = {
      identity: undefined,
      value: 1,
      status: 'idle',
      meta: null,
      context: null,
    };
    listeners = new Set<(snapshot: TestSnapshot) => void>();

    unit = {
      getSnapshot: () => currentSnapshot,
      subscribe: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    };
  });

  describe('happy', () => {
    it('should skip rerender when emitted snapshot does not change selected value', () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount += 1;
        return useLivonSelection<TestSnapshot, number>({
          unit,
          select: (snapshot) => snapshot.value,
        });
      });

      act(() => {
        const nextSnapshot: TestSnapshot = {
          identity: undefined,
          value: 1,
          status: 'idle',
          meta: null,
          context: null,
        };
        currentSnapshot = nextSnapshot;
        listeners.forEach((listener) => {
          listener(nextSnapshot);
        });
      });

      expect(result.current).toBe(1);
      expect(renderCount).toBe(1);
    });

    it('should rerender when emitted snapshot changes selected value', () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount += 1;
        return useLivonSelection<TestSnapshot, number>({
          unit,
          select: (snapshot) => snapshot.value,
        });
      });

      act(() => {
        const nextSnapshot: TestSnapshot = {
          identity: undefined,
          value: 2,
          status: 'success',
          meta: 'updated',
          context: { phase: 'complete' },
        };
        currentSnapshot = nextSnapshot;
        listeners.forEach((listener) => {
          listener(nextSnapshot);
        });
      });

      expect(result.current).toBe(2);
      expect(renderCount).toBe(2);
    });

    it('should keep selector result reference when selector output stays shallow-equal', () => {
      let renderCount = 0;
      const { result } = renderHook(() => {
        renderCount += 1;
        return useLivonSelection<TestSnapshot, { value: number }>({
          unit,
          select: (snapshot) => {
            return {
              value: snapshot.value,
            };
          },
        });
      });
      const firstSelection = result.current;

      act(() => {
        const nextSnapshot: TestSnapshot = {
          identity: undefined,
          value: 1,
          status: 'loading',
          meta: 'pending',
          context: { phase: 'pending' },
        };
        currentSnapshot = nextSnapshot;
        listeners.forEach((listener) => {
          listener(nextSnapshot);
        });
      });

      expect(result.current).toBe(firstSelection);
      expect(renderCount).toBe(1);
    });

    it('should reset cached selection when unit instance changes', () => {
      const firstSnapshot: TestSnapshot = {
        identity: undefined,
        value: 1,
        status: 'idle',
        meta: null,
        context: { phase: 'first' },
      };
      const secondSnapshot: TestSnapshot = {
        identity: undefined,
        value: 1,
        status: 'idle',
        meta: null,
        context: { phase: 'second' },
      };

      let currentUnit: TrackedUnit<number, string> = {
        getSnapshot: () => firstSnapshot,
        subscribe: () => undefined,
      };
      const { result, rerender } = renderHook(() => {
        return useLivonSelection<TestSnapshot, TestSnapshot>({
          unit: currentUnit,
          select: (snapshot) => snapshot,
        });
      });

      expect(result.current).toBe(firstSnapshot);

      currentUnit = {
        getSnapshot: () => secondSnapshot,
        subscribe: () => undefined,
      };
      rerender();

      expect(result.current).toBe(secondSnapshot);
    });
  });
});
