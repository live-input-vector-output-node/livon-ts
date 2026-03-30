import { useCallback } from 'react';

export interface UseLivonRun {
  <TRun extends (...args: readonly unknown[]) => unknown>(unit: {
    run: TRun;
  }): TRun;
}

const useLivonRunInternal: UseLivonRun = <TRun extends (...args: readonly unknown[]) => unknown>(
  unit: {
    run: TRun;
  },
): TRun => {
  const run = unit.run;
  return useCallback(run, [run]);
};

export const useLivonRun: UseLivonRun = useLivonRunInternal;
