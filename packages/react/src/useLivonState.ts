import type {
  ActionUnit,
  SourceUnit,
  StreamUnit,
  TrackedUnit,
  UnitSnapshot,
  UnitStatus,
} from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';
import type { LivonState, LivonStateOf } from './types.js';

export interface UseLivonState {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonStateOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;

  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonStateOf<ActionUnit<TPayload, RResult, UUpdate>>;

  <
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: StreamUnit<TPayload, RResult, UUpdate>): LivonStateOf<StreamUnit<TPayload, RResult, UUpdate>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyStateUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

const useLivonStateInternal = <
  TResult,
  TUnit extends TrackedUnit<TResult> & AnyStateUnit,
>(
  unit: TUnit,
): LivonState<TResult, UnitStatus, unknown> => {
  const value = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TResult>) => {
      return snapshot.value;
    },
  });
  const status = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TResult>): UnitStatus => {
      return snapshot.status;
    },
  });
  const meta = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TResult>) => {
      return snapshot.meta;
    },
  });

  return {
    value,
    status,
    meta,
  };
};

export const useLivonState: UseLivonState = useLivonStateInternal;
