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

type LivonRunFunction<TUnit> =
  TUnit extends { run: infer TRun }
    ? TRun
    : never;

type LivonStartFunction<TUnit> =
  TUnit extends { start: infer TStart }
    ? TStart
    : never;

export type LivonRunOf<TUnit> =
  LivonRunFunction<TUnit> extends (...input: infer TInput) => infer TResult
    ? (...input: TInput) => TResult
    : LivonStartFunction<TUnit> extends (...input: infer TInput) => infer TResult
      ? (...input: TInput) => TResult
      : never;

export type LivonStopOf<TUnit> =
  TUnit extends { stop: () => infer TResult }
    ? () => TResult
    : never;

export type LivonDraftOf<TUnit> =
  TUnit extends {
    setDraft: (input: infer TInput) => infer TSetResult;
    cleanDraft: () => infer TCleanResult;
  }
    ? [
      (input: TInput) => TSetResult,
      () => TCleanResult,
    ]
    : never;
