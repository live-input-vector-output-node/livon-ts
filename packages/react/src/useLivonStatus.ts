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
>(unit: SourceUnit<TInput, TPayload, RResult>): LivonStatusOf<
    SourceUnit<TInput, TPayload, RResult>
  >;

  <
  RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult>): LivonStatusOf<ActionUnit<TPayload, RResult>>;

  <
  TPayload,
  RResult,
>(unit: StreamUnit<TPayload, RResult>): LivonStatusOf<StreamUnit<TPayload, RResult>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown>;
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
