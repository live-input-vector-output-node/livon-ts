import type { StreamUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStop } from './useLivonStop.js';
import type { LivonStreamStateOf } from './types.js';

export interface UseLivonStreamState {
  <
  TPayload,
  RResult,
>(unit: StreamUnit<TPayload, RResult>): LivonStreamStateOf<StreamUnit<TPayload, RResult>>;
}

const useLivonStreamStateInternal: UseLivonStreamState = <
  TPayload,
  RResult,
>(
  unit: StreamUnit<TPayload, RResult>,
): LivonStreamStateOf<StreamUnit<TPayload, RResult>> => {
  const state = useLivonState(unit);
  const start = useLivonRun(unit);
  const stop = useLivonStop(unit);

  return {
    ...state,
    start,
    stop,
  };
};

export const useLivonStreamState: UseLivonStreamState = useLivonStreamStateInternal;
