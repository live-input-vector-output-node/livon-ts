import type { SourceUnit } from '@livon/sync';
import { useCallback } from 'react';

import { useLivonDraft } from './useLivonDraft.js';
import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStop } from './useLivonStop.js';
import type { LivonSourceStateOf } from './types.js';

export interface UseLivonSourceState {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonSourceStateOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;
}

const useLivonSourceStateInternal: UseLivonSourceState = <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(
  unit: SourceUnit<TInput, TPayload, RResult, UUpdate>,
): LivonSourceStateOf<SourceUnit<TInput, TPayload, RResult, UUpdate>> => {
  const state = useLivonState(unit);
  const run = useLivonRun(unit);
  const stop = useLivonStop(unit);
  const [setDraft, cleanDraft] = useLivonDraft(unit);

  const refetch = useCallback((payloadInput?: TPayload | ((input: TPayload) => TPayload)) => {
    return unit.refetch(payloadInput);
  }, [unit]);

  const force = useCallback((payloadInput?: TPayload | ((input: TPayload) => TPayload)) => {
    return unit.force(payloadInput);
  }, [unit]);

  return {
    ...state,
    run,
    refetch,
    force,
    stop,
    draft: {
      set: setDraft,
      clean: cleanDraft,
    },
  };
};

export const useLivonSourceState: UseLivonSourceState = useLivonSourceStateInternal;
