import type { ActionUnit } from '@livon/sync';

import { useLivonRun } from './useLivonRun.js';
import { useLivonState } from './useLivonState.js';
import type { LivonActionStateOf } from './types.js';

export interface UseLivonActionState {
  <
  RResult,
  TPayload,
  TMeta = unknown,
  >(unit: ActionUnit<TPayload, RResult, TMeta>): LivonActionStateOf<ActionUnit<TPayload, RResult, TMeta>>;
}

const useLivonActionStateInternal: UseLivonActionState = <
  RResult,
  TPayload,
  TMeta = unknown,
>(
  unit: ActionUnit<TPayload, RResult, TMeta>,
): LivonActionStateOf<ActionUnit<TPayload, RResult, TMeta>> => {
  const state = useLivonState(unit);
  const run = useLivonRun(unit);

  return {
    ...state,
    run,
  };
};

export const useLivonActionState: UseLivonActionState = useLivonActionStateInternal;
