import { useCallback } from 'react';

export interface UseLivonRun {
  <
    TInput extends readonly unknown[],
    TResult,
  >(unit: {
    run: (...input: TInput) => TResult;
  }): (...input: TInput) => TResult;

  <
    TInput extends readonly unknown[],
    TResult,
  >(unit: {
    start: (...input: TInput) => TResult;
  }): (...input: TInput) => TResult;
}

interface RunCapability {
  run: (...input: readonly unknown[]) => unknown;
}

interface StartCapability {
  start: (...input: readonly unknown[]) => unknown;
}

interface ReadCallablePropertyInput {
  input: unknown;
  key: 'run' | 'start';
}

const readCallableProperty = ({
  input,
  key,
}: ReadCallablePropertyInput): unknown => {
  if ((typeof input !== 'object' && typeof input !== 'function') || input === null) {
    return undefined;
  }

  return Reflect.get(input, key);
};

const isRunCapability = <TUnit>(
  unit: TUnit,
): unit is TUnit & RunCapability => {
  return typeof readCallableProperty({ input: unit, key: 'run' }) === 'function';
};

const isStartCapability = <TUnit>(
  unit: TUnit,
): unit is TUnit & StartCapability => {
  return typeof readCallableProperty({ input: unit, key: 'start' }) === 'function';
};

const useLivonRunInternal: UseLivonRun = <TUnit>(
  unit: TUnit,
): ((...input: readonly unknown[]) => unknown) => {
  if (isRunCapability(unit)) {
    const run = unit.run;
    return useCallback((...input: Parameters<typeof run>) => {
      return run(...input);
    }, [run]);
  }

  if (isStartCapability(unit)) {
    const start = unit.start;
    return useCallback((...input: Parameters<typeof start>) => {
      return start(...input);
    }, [start]);
  }

  throw new Error('useLivonRun requires a unit with run() or start() capability.');
};

export const useLivonRun: UseLivonRun = useLivonRunInternal;
