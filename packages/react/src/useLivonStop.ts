import type { ActionUnit, SourceUnit, StreamUnit } from '@livon/sync';
import { useCallback } from 'react';

import type { LivonStopOf } from './types.js';

export interface UseLivonStop {
  <
  TInput extends object | undefined,
  TPayload,
  RResult,
>(unit: SourceUnit<TInput, TPayload, RResult>): LivonStopOf<
    SourceUnit<TInput, TPayload, RResult>
  >;

  <
  RResult,
  TPayload,
>(unit: ActionUnit<TPayload, RResult>): LivonStopOf<ActionUnit<TPayload, RResult>>;

  <
  TPayload,
  RResult,
>(unit: StreamUnit<TPayload, RResult>): LivonStopOf<StreamUnit<TPayload, RResult>>;
}

type AnySourceUnit = SourceUnit<object | undefined, unknown, unknown>;
type AnyActionUnit = ActionUnit<unknown, unknown>;
type AnyStreamUnit = StreamUnit<unknown, unknown>;
type AnyStopUnit = AnySourceUnit | AnyActionUnit | AnyStreamUnit;

const useLivonStopInternal = <TUnit extends AnyStopUnit>(
  unit: TUnit,
): LivonStopOf<TUnit> => {
  return useCallback(() => {
    unit.stop();
  }, [unit]) as LivonStopOf<TUnit>;
};

export const useLivonStop: UseLivonStop = useLivonStopInternal;
