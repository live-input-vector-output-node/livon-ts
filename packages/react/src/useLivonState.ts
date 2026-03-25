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
  TMeta,
  >(unit: SourceUnit<TInput, TPayload, RResult, TMeta>): LivonStateOf<
    SourceUnit<TInput, TPayload, RResult, TMeta>
  >;

  <
  RResult,
  TPayload,
  TMeta,
  >(unit: ActionUnit<TPayload, RResult, TMeta>): LivonStateOf<ActionUnit<TPayload, RResult, TMeta>>;

  <
  TPayload,
  RResult,
  TMeta,
  >(unit: StreamUnit<TPayload, RResult, TMeta>): LivonStateOf<StreamUnit<TPayload, RResult, TMeta>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyStateUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

const useLivonStateInternal: UseLivonState = <
  TValue,
  TMeta,
  TUnit extends TrackedUnit<TValue, TMeta> & AnyStateUnit,
>(
  unit: TUnit,
): LivonState<TValue, UnitStatus, TMeta | null> => {
  const value = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TValue, TMeta | null>) => {
      return snapshot.value;
    },
  });
  const status = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TValue, TMeta | null>): UnitStatus => {
      return snapshot.status;
    },
  });
  const meta = useLivonSelection({
    unit,
    select: (snapshot: UnitSnapshot<TValue, TMeta | null>) => {
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
