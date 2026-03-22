import type {
  ActionUnit,
  SourceUnit,
  StreamUnit,
  UnitSnapshot,
  UnitStatus,
} from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';
import type { LivonStatusOf } from './types.js';

export interface UseLivonStatus {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonStatusOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;

  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonStatusOf<ActionUnit<TPayload, RResult, UUpdate>>;

  <
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: StreamUnit<TPayload, RResult, UUpdate>): LivonStatusOf<StreamUnit<TPayload, RResult, UUpdate>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyStatusUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

interface SelectStatus {
  <RResult>(snapshot: UnitSnapshot<RResult>): UnitStatus;
}

const selectStatus: SelectStatus = (snapshot) => {
  return snapshot.status;
};

const useLivonStatusInternal = <TUnit extends AnyStatusUnit>(
  unit: TUnit,
): LivonStatusOf<TUnit> => {
  const status = useLivonSelection({
    unit,
    select: selectStatus,
  });

  return status as LivonStatusOf<TUnit>;
};

export const useLivonStatus: UseLivonStatus = useLivonStatusInternal;
