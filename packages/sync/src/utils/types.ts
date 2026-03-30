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

export interface UnitRunPrevious<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
> {
  snapshot: UnitSnapshot<TData, TMeta>;
  data: TDataInput | undefined;
  config: TConfig | undefined;
}

export interface UnitSetAction<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
> {
  (
    previous: UnitRunPrevious<TDataInput, TConfig, TData, TMeta>,
    config: TConfig | undefined,
  ): TDataInput | undefined;
}

export interface UnitRun<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
> {
  (): Promise<void>;
  (data: TDataInput): Promise<void>;
  (data: TDataInput | undefined, config: TConfig): Promise<void>;
  (setAction: UnitSetAction<TDataInput, TConfig, TData, TMeta>, config?: TConfig): Promise<void>;
}
