export interface InputUpdater<TInput> {
  (previous: TInput): TInput;
}

export interface ValueUpdater<RResult, UUpdate> {
  (previous: RResult): UUpdate;
}

export type UnitStatus = 'idle' | 'rehydrated' | 'loading' | 'refreshing' | 'success' | 'error';

export interface UnitSnapshot<
  RResult,
  TMeta = unknown,
> {
  value: RResult;
  status: UnitStatus;
  meta: TMeta;
  context: unknown;
}

export interface CreateUnitSnapshotInput<
  RResult,
  TMeta = unknown,
> {
  value: RResult;
  status: UnitStatus;
  meta: TMeta;
  context: unknown;
}

export interface EffectListener<
  RResult,
  TMeta = unknown,
> {
  (snapshot: UnitSnapshot<RResult, TMeta>): void;
}
