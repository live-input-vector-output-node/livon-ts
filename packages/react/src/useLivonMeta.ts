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
  TMeta = unknown,
  >(unit: SourceUnit<TInput, TPayload, RResult, TMeta>): LivonMetaOf<
    SourceUnit<TInput, TPayload, RResult, TMeta>
  >;

  <
  RResult,
  TPayload,
  TMeta = unknown,
  >(unit: ActionUnit<TPayload, RResult, TMeta>): LivonMetaOf<ActionUnit<TPayload, RResult, TMeta>>;

  <
  TPayload,
  RResult,
  TMeta = unknown,
  >(unit: StreamUnit<TPayload, RResult, TMeta>): LivonMetaOf<StreamUnit<TPayload, RResult, TMeta>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyMetaUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

interface SelectMeta {
  <RResult, TMeta>(snapshot: UnitSnapshot<RResult, TMeta | null>): TMeta | null;
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
