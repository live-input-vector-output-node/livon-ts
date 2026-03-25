import type {
  ActionUnit,
  SourceUnit,
  StreamUnit,
  TrackedUnit,
  UnitSnapshot,
} from '@livon/sync';

import { useLivonSelection } from './useLivonSelection.js';
import type { LivonMetaOf } from './types.js';

export interface UseLivonMeta {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  TMeta,
  >(unit: SourceUnit<TInput, TPayload, RResult, TMeta>): LivonMetaOf<
    SourceUnit<TInput, TPayload, RResult, TMeta>
  >;

  <
  RResult,
  TPayload,
  TMeta,
  >(unit: ActionUnit<TPayload, RResult, TMeta>): LivonMetaOf<ActionUnit<TPayload, RResult, TMeta>>;

  <
  TPayload,
  RResult,
  TMeta,
  >(unit: StreamUnit<TPayload, RResult, TMeta>): LivonMetaOf<StreamUnit<TPayload, RResult, TMeta>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyMetaUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

const selectMeta = <TValue, TMeta>(
  snapshot: UnitSnapshot<TValue, TMeta | null>,
): TMeta | null => {
  return snapshot.meta;
};

const useLivonMetaInternal: UseLivonMeta = <
  TValue,
  TMeta,
  TUnit extends TrackedUnit<TValue, TMeta> & AnyMetaUnit,
>(
  unit: TUnit,
): TMeta | null => {
  return useLivonSelection({
    unit,
    select: selectMeta<TValue, TMeta>,
  });
};

export const useLivonMeta: UseLivonMeta = useLivonMetaInternal;
