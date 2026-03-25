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
>(unit: SourceUnit<TInput, TPayload, RResult>): LivonMetaOf<
    SourceUnit<TInput, TPayload, RResult>
  >;

  <
  RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult>): LivonMetaOf<ActionUnit<TPayload, RResult>>;

  <
  TPayload,
  RResult,
>(unit: StreamUnit<TPayload, RResult>): LivonMetaOf<StreamUnit<TPayload, RResult>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown>;
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
