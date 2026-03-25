import type { ActionUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStop } from './useLivonStop.js';
import type { LivonActionStateOf } from './types.js';

export interface UseLivonActionState {
  <
  RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult>): LivonActionStateOf<ActionUnit<TPayload, RResult>>;
}

const useLivonActionStateInternal: UseLivonActionState = <
  RResult,
  TPayload,
>(
  unit: ActionUnit<TPayload, RResult>,
): LivonActionStateOf<ActionUnit<TPayload, RResult>> => {
  const state = useLivonState(unit);
  const run = useLivonRun(unit);
  const stop = useLivonStop(unit);

  return {
    ...state,
    run,
    stop,
  };
};

export const useLivonActionState: UseLivonActionState = useLivonActionStateInternal;
