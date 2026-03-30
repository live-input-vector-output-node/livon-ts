import type { StreamUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import type { LivonStreamStateOf } from './types.js';

export interface UseLivonStreamState {
  <
  TPayload,
  RResult,
  TMeta = unknown,
  >(unit: StreamUnit<TPayload, RResult, TMeta>): LivonStreamStateOf<StreamUnit<TPayload, RResult, TMeta>>;
}

const useLivonStreamStateInternal: UseLivonStreamState = <
  TPayload,
  RResult,
  TMeta = unknown,
>(
  unit: StreamUnit<TPayload, RResult, TMeta>,
): LivonStreamStateOf<StreamUnit<TPayload, RResult, TMeta>> => {
  const state = useLivonState(unit);
  const run = useLivonRun(unit);

  return {
    ...state,
    run,
  };
};

export const useLivonStreamState: UseLivonStreamState = useLivonStreamStateInternal;
