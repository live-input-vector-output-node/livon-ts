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
  TMeta = unknown,
  >(unit: SourceUnit<TInput, TPayload, RResult, TMeta>): LivonStateOf<
    SourceUnit<TInput, TPayload, RResult, TMeta>
  >;

  <
  RResult,
  TPayload,
  TMeta = unknown,
  >(unit: ActionUnit<TPayload, RResult, TMeta>): LivonStateOf<ActionUnit<TPayload, RResult, TMeta>>;

  <
  TPayload,
  RResult,
  TMeta = unknown,
  >(unit: StreamUnit<TPayload, RResult, TMeta>): LivonStateOf<StreamUnit<TPayload, RResult, TMeta>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyStateUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

interface SelectStateValue {
  <TValue, TMeta>(snapshot: UnitSnapshot<TValue, TMeta | null>): TValue;
}

interface SelectStateStatus {
  <TValue, TMeta>(snapshot: UnitSnapshot<TValue, TMeta | null>): UnitStatus;
}

interface SelectStateMeta {
  <TValue, TMeta>(snapshot: UnitSnapshot<TValue, TMeta | null>): TMeta | null;
}

const selectStateValue: SelectStateValue = (snapshot) => {
  return snapshot.value;
};

const selectStateStatus: SelectStateStatus = (snapshot) => {
  return snapshot.status;
};

const selectStateMeta: SelectStateMeta = (snapshot) => {
  return snapshot.meta;
};

const useLivonStateInternal: UseLivonState = <
  TValue,
  TMeta,
  TUnit extends TrackedUnit<TValue, TMeta> & AnyStateUnit,
>(
  unit: TUnit,
): LivonState<TValue, UnitStatus, TMeta | null> => {
  const value = useLivonSelection<TValue, TValue, TMeta>({
    unit,
    select: selectStateValue,
  });
  const status = useLivonSelection<TValue, UnitStatus, TMeta>({
    unit,
    select: selectStateStatus,
  });
  const meta = useLivonSelection<TValue, TMeta | null, TMeta>({
    unit,
    select: selectStateMeta,
  });

  return {
    value,
    status,
    meta,
  };
};

export const useLivonState: UseLivonState = useLivonStateInternal;
