import type { TrackedUnit, UnitStatus } from '@livon/sync';

export type LivonSnapshotOf<TUnit> =
  TUnit extends { effect: (listener: (snapshot: infer TSnapshot) => void) => (() => void) | void }
    ? TSnapshot
    : never;

export type LivonValueOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { value: infer TValue }
    ? TValue
    : never;

export type LivonStatusOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { status: infer TStatus }
    ? TStatus
    : never;

export type LivonMetaOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { meta: infer TMeta }
    ? TMeta
    : never;

export interface LivonState<
  TValue,
  TStatus,
  TMeta,
> {
  value: TValue;
  status: TStatus;
  meta: TMeta;
}

export type LivonStateOf<TUnit> = LivonState<
  TUnit extends TrackedUnit<infer TValue> ? TValue : never,
  UnitStatus,
  unknown
>;

type LivonRunFunction<TUnit> =
  TUnit extends { run: infer TRun }
    ? TRun
    : never;

type LivonStartFunction<TUnit> =
  TUnit extends { start: infer TStart }
    ? TStart
    : never;

export type LivonRunOf<TUnit> =
  [LivonRunFunction<TUnit>] extends [never]
    ? [LivonStartFunction<TUnit>] extends [(...input: infer TInput) => infer TResult]
      ? (...input: TInput) => TResult
      : never
    : [LivonRunFunction<TUnit>] extends [(...input: infer TInput) => infer TResult]
      ? (...input: TInput) => TResult
      : never;

export type LivonStopOf<TUnit> =
  TUnit extends { stop: () => infer TResult }
    ? () => TResult
    : never;

export type LivonDraftOf<TUnit> =
  TUnit extends {
    draft: {
      set: (input: infer TInput) => infer TSetResult;
      clean: () => infer TCleanResult;
    };
  }
    ? [
      (input: TInput) => TSetResult,
      () => TCleanResult,
    ]
    : never;

type LivonRefetchOf<TUnit> =
  TUnit extends { refetch: infer TRefetch }
    ? TRefetch
    : never;

type LivonForceOf<TUnit> =
  TUnit extends { force: infer TForce }
    ? TForce
    : never;

export type LivonSourceStateOf<TUnit> = LivonStateOf<TUnit> & {
  run: LivonRunOf<TUnit>;
  refetch: LivonRefetchOf<TUnit>;
  force: LivonForceOf<TUnit>;
  stop: LivonStopOf<TUnit>;
  draft: {
    set: LivonDraftOf<TUnit>[0];
    clean: LivonDraftOf<TUnit>[1];
  };
};

export type LivonActionStateOf<TUnit> = LivonStateOf<TUnit> & {
  run: LivonRunOf<TUnit>;
  stop: LivonStopOf<TUnit>;
};

export type LivonStreamStateOf<TUnit> = LivonStateOf<TUnit> & {
  start: LivonRunOf<TUnit>;
  stop: LivonStopOf<TUnit>;
};
