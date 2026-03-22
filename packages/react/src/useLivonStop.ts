import type { ActionUnit, SourceUnit, StreamUnit } from '@livon/sync';
import { useCallback } from 'react';

import type { LivonStopOf } from './types.js';

export interface UseLivonStop {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: SourceUnit<TInput, TPayload, RResult, UUpdate>): LivonStopOf<
    SourceUnit<TInput, TPayload, RResult, UUpdate>
  >;

  <
  RResult,
  UUpdate extends RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult, UUpdate>): LivonStopOf<ActionUnit<TPayload, RResult, UUpdate>>;

  <
  TPayload,
  RResult,
  UUpdate extends RResult,
>(unit: StreamUnit<TPayload, RResult, UUpdate>): LivonStopOf<StreamUnit<TPayload, RResult, UUpdate>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown, unknown>;
type AnyStopUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

const useLivonStopInternal = <TUnit extends AnyStopUnit>(
  unit: TUnit,
): LivonStopOf<TUnit> => {
  return useCallback(() => {
    unit.stop();
  }, [unit]) as LivonStopOf<TUnit>;
};

export const useLivonStop: UseLivonStop = useLivonStopInternal;
