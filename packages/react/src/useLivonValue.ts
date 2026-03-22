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
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonValueOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;

  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonValueOf<ActionUnit<TPayload, RResult, UUpdate>>;

  <
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: StreamUnit<TPayload, RResult, UUpdate>): LivonValueOf<StreamUnit<TPayload, RResult, UUpdate>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
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
