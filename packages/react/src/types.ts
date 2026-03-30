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
  TUnit extends { run: infer TRun }
    ? TRun
    : never;

export type LivonSourceStateOf<TUnit> = LivonStateOf<TUnit> & {
  run: LivonRunOf<TUnit>;
};

export type LivonActionStateOf<TUnit> = LivonStateOf<TUnit> & {
  run: LivonRunOf<TUnit>;
};

export type LivonStreamStateOf<TUnit> = LivonStateOf<TUnit> & {
  run: LivonRunOf<TUnit>;
};
