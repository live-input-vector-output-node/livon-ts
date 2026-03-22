import type {
  ActionUnit,
  SourceUnit,
  StreamUnit,
  UnitSnapshot,
} from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';
import type { LivonMetaOf } from './types.js';

export interface UseLivonMeta {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonMetaOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;

  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonMetaOf<ActionUnit<TPayload, RResult, UUpdate>>;

  <
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: StreamUnit<TPayload, RResult, UUpdate>): LivonMetaOf<StreamUnit<TPayload, RResult, UUpdate>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyMetaUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

interface SelectMeta {
  <RResult>(snapshot: UnitSnapshot<RResult>): unknown;
}

const selectMeta: SelectMeta = (snapshot) => {
  return snapshot.meta;
};

const useLivonMetaInternal = <TUnit extends AnyMetaUnit>(
  unit: TUnit,
): LivonMetaOf<TUnit> => {
  const meta = useLivonSelection({
    unit,
    select: selectMeta,
  });

  return meta as LivonMetaOf<TUnit>;
};

export const useLivonMeta: UseLivonMeta = useLivonMetaInternal;
