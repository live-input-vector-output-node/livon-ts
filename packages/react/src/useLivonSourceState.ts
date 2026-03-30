import type { SourceUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import type { LivonSourceStateOf } from './types.js';

export interface UseLivonSourceState {
  <
  TIdentity extends object | undefined,
  TPayload,
  RResult,
  TMeta = unknown,
  >(unit: SourceUnit<TIdentity, TPayload, RResult, TMeta>): LivonSourceStateOf<
    SourceUnit<TIdentity, TPayload, RResult, TMeta>
  >;
}

const useLivonSourceStateInternal: UseLivonSourceState = <
  TIdentity extends object | undefined,
  TPayload,
  RResult,
  TMeta = unknown,
>(
  unit: SourceUnit<TIdentity, TPayload, RResult, TMeta>,
): LivonSourceStateOf<SourceUnit<TIdentity, TPayload, RResult, TMeta>> => {
  const state = useLivonState(unit);
  const run = useLivonRun(unit);

  return {
    ...state,
    run,
  };
};

export const useLivonSourceState: UseLivonSourceState = useLivonSourceStateInternal;
