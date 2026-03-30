import type {
  ActionUnit,
  SourceUnit,
  StreamUnit,
  UnitSnapshot,
} from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';
import type { LivonValueOf } from './types.js';

export interface UseLivonValue {
  <
  TIdentity extends object | undefined,
  TPayload,
  RResult,
>(unit: SourceUnit<TIdentity, TPayload, RResult>): LivonValueOf<
    SourceUnit<TIdentity, TPayload, RResult>
  >;

  <
  RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult>): LivonValueOf<ActionUnit<TPayload, RResult>>;

  <
  TPayload,
  RResult,
>(unit: StreamUnit<TPayload, RResult>): LivonValueOf<StreamUnit<TPayload, RResult>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown>;
type AnyValueUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

interface SelectValue {
  <RResult>(snapshot: UnitSnapshot<RResult>): RResult;
}

const selectValue: SelectValue = (snapshot) => {
  return snapshot.value;
};

const useLivonValueInternal = <TUnit extends AnyValueUnit>(
  unit: TUnit,
): LivonValueOf<TUnit> => {
  const value = useLivonSelection({
    unit,
    select: selectValue,
  });

  return value as LivonValueOf<TUnit>;
};

export const useLivonValue: UseLivonValue = useLivonValueInternal;
