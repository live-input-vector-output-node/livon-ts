import { useCallback } from 'react';

import type { LivonRunOf } from './types.js';

export interface UseLivonRun {
  <TUnit>(unit: TUnit): LivonRunOf<TUnit>;
}

interface RunCapability {
  run: (...input: readonly unknown[]) => unknown;
}

interface StartCapability {
  start: (...input: readonly unknown[]) => unknown;
}

interface RunCapabilityRoot {
  run?: unknown;
  start?: unknown;
}

const isRunCapability = (
  unit: unknown,
): unit is RunCapability => {
  const unitType = typeof unit;
  if ((unitType !== 'object' && unitType !== 'function') || unit === null) {
    return false;
  }

  const root = unit as RunCapabilityRoot;
  return typeof root.run === 'function';
};

const isStartCapability = (
  unit: unknown,
): unit is StartCapability => {
  const unitType = typeof unit;
  if ((unitType !== 'object' && unitType !== 'function') || unit === null) {
    return false;
  }

  const root = unit as RunCapabilityRoot;
  return typeof root.start === 'function';
};

const useLivonRunInternal: UseLivonRun = <TUnit>(
  unit: TUnit,
): LivonRunOf<TUnit> => {
  const hasRunCapability = isRunCapability(unit);
  const hasStartCapability = isStartCapability(unit);

  if (!hasRunCapability && !hasStartCapability) {
    throw new Error('useLivonRun requires a unit with run() or start() capability.');
  }

  const run = (
    hasRunCapability ? unit.run : (unit as StartCapability).start
  ) as (...input: readonly unknown[]) => unknown;

  return useCallback((...input: readonly unknown[]) => {
    return run(...input);
  }, [run]) as LivonRunOf<TUnit>;
};

export const useLivonRun: UseLivonRun = useLivonRunInternal;
