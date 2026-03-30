export interface InputUpdater<TInput> {
  (previous: TInput): TInput;
}

export interface ValueUpdater<RResult, UUpdate> {
  (previous: RResult): UUpdate;
}

export type UnitStatus = 'idle' | 'rehydrated' | 'loading' | 'refreshing' | 'success' | 'error';

export interface UnitBase<
  TIdentity,
  RResult,
  TState extends string,
  TMeta = unknown,
  TContext = unknown,
> {
  identity: TIdentity;
  value: RResult;
  status: TState;
  meta: TMeta | null;
  context: TContext;
}

export interface SnapshotBase<
  RResult,
  TState extends string,
  TMeta = unknown,
> {
  value: RResult;
  status: TState;
  meta: TMeta | null;
}

export type Snapshot<
  RResult,
  TState extends string,
  TMeta = unknown,
  TAdditionals extends object = {},
> = SnapshotBase<RResult, TState, TMeta> & TAdditionals;

export type UnitSnapshot<
  RResult,
  TMeta = unknown,
  TContext = unknown,
  TIdentity = object | undefined,
> = Snapshot<
  RResult,
  UnitStatus,
  TMeta,
  {
    identity: TIdentity;
    context: TContext;
  }
>;

export interface CreateUnitSnapshotInput<
  RResult,
  TMeta = unknown,
  TContext = unknown,
  TIdentity = object | undefined,
> extends SnapshotBase<
  RResult,
  UnitStatus,
  TMeta
> {
  identity: TIdentity;
  context: TContext;
}

export interface EffectListener<
  RResult,
  TMeta = unknown,
  TContext = unknown,
  TIdentity = object | undefined,
> {
  (snapshot: UnitSnapshot<RResult, TMeta, TContext, TIdentity>): void;
}

export interface UnitRunPrevious<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
  TContext = unknown,
> {
  snapshot: UnitSnapshot<TData, TMeta, TContext>;
  data: TDataInput | undefined;
  config: TConfig | undefined;
}

export interface UnitSetAction<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
  TContext = unknown,
> {
  (
    previous: UnitRunPrevious<TDataInput, TConfig, TData, TMeta, TContext>,
    config: TConfig | undefined,
  ): TDataInput | undefined;
}

export interface UnitRun<
  TDataInput,
  TConfig,
  TData,
  TMeta = unknown,
  TContext = unknown,
> {
  (): Promise<void>;
  (data: TDataInput): Promise<void>;
  (data: TDataInput | undefined, config: TConfig): Promise<void>;
  (setAction: UnitSetAction<TDataInput, TConfig, TData, TMeta, TContext>, config?: TConfig): Promise<void>;
}
