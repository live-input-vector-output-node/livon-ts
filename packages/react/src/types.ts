export type LivonSnapshotOf<TUnit> =
  TUnit extends { getSnapshot: () => infer TSnapshot }
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
  LivonValueOf<TUnit>,
  LivonStatusOf<TUnit>,
  LivonMetaOf<TUnit>
>;

export type LivonRunOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { load: infer TLoad }
    ? TLoad
    : LivonSnapshotOf<TUnit> extends { submit: infer TSubmit }
      ? TSubmit
      : LivonSnapshotOf<TUnit> extends { start: infer TStart }
        ? TStart
        : LivonSnapshotOf<TUnit> extends { apply: infer TApply }
          ? TApply
          : LivonSnapshotOf<TUnit> extends { refresh: infer TRefresh }
            ? TRefresh
            : never;

export type LivonLoadOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { load: infer TLoad }
    ? TLoad
    : never;

export type LivonRefetchOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { refetch: infer TRefetch }
    ? TRefetch
    : never;

export type LivonForceOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { force: infer TForce }
    ? TForce
    : never;

export type LivonSubmitOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { submit: infer TSubmit }
    ? TSubmit
    : never;

export type LivonStartOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { start: infer TStart }
    ? TStart
    : never;

export type LivonStopOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { stop: infer TStop }
    ? TStop
    : never;

export type LivonSetOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { set: infer TSet }
    ? TSet
    : never;

export type LivonClearOf<TUnit> =
  LivonSnapshotOf<TUnit> extends { clear: infer TClear }
    ? TClear
    : never;

export type LivonSourceStateOf<TUnit> = LivonStateOf<TUnit> & {
  load: LivonLoadOf<TUnit>;
  refetch: LivonRefetchOf<TUnit>;
  force: LivonForceOf<TUnit>;
};

export type LivonActionStateOf<TUnit> = LivonStateOf<TUnit> & {
  submit: LivonSubmitOf<TUnit>;
};

export type LivonStreamStateOf<TUnit> = LivonStateOf<TUnit> & {
  start: LivonStartOf<TUnit>;
  stop: LivonStopOf<TUnit>;
};

export type LivonDraftStateOf<TUnit> = LivonStateOf<TUnit> & {
  set: LivonSetOf<TUnit>;
  clear: LivonClearOf<TUnit>;
  reset: LivonSnapshotOf<TUnit> extends { reset: infer TReset } ? TReset : never;
};
