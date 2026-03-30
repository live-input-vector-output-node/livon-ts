export type UnitEntityMode = 'one' | 'many';

export type UnitDataByEntityMode<
  TEntity extends object,
  TMode extends UnitEntityMode,
> = TMode extends 'many'
  ? readonly TEntity[]
  : TEntity | null;

type UnitDataItem<TData> = TData extends readonly (infer TItem)[] ? TItem : TData;
type UnitDataEntityCandidate<TData> = Extract<NonNullable<UnitDataItem<TData>>, object>;

export type UnitDataEntity<TData> = [UnitDataEntityCandidate<TData>] extends [never]
  ? object
  : UnitDataEntityCandidate<TData>;

export type UnitDataUpdate<TData> = TData extends readonly unknown[]
  ? TData
  : UnitDataEntity<TData>;
