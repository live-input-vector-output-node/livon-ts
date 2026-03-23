import type { ActionUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStop } from './useLivonStop.js';
import type { LivonActionStateOf } from './types.js';

export interface UseLivonActionState {
  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonActionStateOf<ActionUnit<TPayload, RResult, UUpdate>>;
}

const useLivonActionStateInternal: UseLivonActionState = <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(
  unit: ActionUnit<TPayload, RResult, UUpdate>,
): LivonActionStateOf<ActionUnit<TPayload, RResult, UUpdate>> => {
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
