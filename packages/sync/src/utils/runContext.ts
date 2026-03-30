import { type EntityId, type UpsertOptions } from '../entity.js';
import { type UnitDataEntity } from './unitDataTypes.js';
import { type UnitBase, type UnitStatus, type ValueUpdater } from './types.js';

export type RunContextBase<
  TIdentity,
  TData,
  TMeta = unknown,
  TContext = unknown,
> = UnitBase<TIdentity, TData, UnitStatus, TMeta, TContext>;

export interface EntityMutationRunContext<
  TIdentity,
  TPayload,
  TData,
  TMeta = unknown,
  TContext = unknown,
  TEntity extends object = UnitDataEntity<TData>,
> extends RunContextBase<
  TIdentity,
  TData,
  TMeta,
  TContext
> {
  payload: TPayload;
  setMeta: (meta: TMeta | null | ValueUpdater<TMeta | null, TMeta | null>) => void;
  upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
  upsertMany: (
    input: readonly TEntity[],
    options?: UpsertOptions,
  ) => readonly TEntity[];
  deleteOne: (id: EntityId) => boolean;
  deleteMany: (ids: readonly EntityId[]) => readonly EntityId[];
  getValue: () => TData;
}
