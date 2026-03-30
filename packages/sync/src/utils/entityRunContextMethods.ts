import { type Entity, type EntityId, type UpsertOptions } from '../entity.js';
import {
  setManyEntityMembership,
  setOneEntityMembership,
  type EntityMembershipState,
} from './entityMembership.js';

export interface EntityRunContextMethods<
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
> {
  upsertOne: (input: TEntity, options?: UpsertOptions) => TEntity;
  upsertMany: (input: readonly TEntity[], options?: UpsertOptions) => readonly TEntity[];
  deleteOne: (id: TEntityId) => boolean;
  deleteMany: (ids: readonly TEntityId[]) => readonly TEntityId[];
  getValue: () => RResult;
}

export interface CreateEntityRunContextMethodsInput<
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
> {
  entity: Entity<TEntity, TEntityId>;
  state: EntityMembershipState<TEntityId>;
  isActive: () => boolean;
  refreshValue: () => void;
  readValue: () => RResult;
  refreshOnGet?: boolean;
  upsertOneOperation?: string;
  upsertManyOperation?: string;
}

const DEFAULT_UPSERT_ONE_OPERATION = 'runContext.upsertOne()';
const DEFAULT_UPSERT_MANY_OPERATION = 'runContext.upsertMany()';

export const createEntityRunContextMethods = <
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
>({
  entity,
  state,
  isActive,
  refreshValue,
  readValue,
  refreshOnGet = false,
  upsertOneOperation = DEFAULT_UPSERT_ONE_OPERATION,
  upsertManyOperation = DEFAULT_UPSERT_MANY_OPERATION,
}: CreateEntityRunContextMethodsInput<
  TEntity,
  RResult,
  TEntityId
>): EntityRunContextMethods<TEntity, RResult, TEntityId> => {
  const upsertOne = (input: TEntity, options?: UpsertOptions): TEntity => {
    if (!isActive()) {
      return input;
    }

    const updated = entity.upsertOne(input, options);
    setOneEntityMembership(state, {
      entity,
      value: updated,
      operation: upsertOneOperation,
    });
    refreshValue();
    return updated;
  };

  const upsertMany = (
    input: readonly TEntity[],
    options?: UpsertOptions,
  ): readonly TEntity[] => {
    if (!isActive()) {
      return input;
    }

    const updated = entity.upsertMany(input, options);
    setManyEntityMembership(state, {
      entity,
      values: updated,
      operation: upsertManyOperation,
    });
    refreshValue();
    return updated;
  };

  const deleteOne = (id: TEntityId): boolean => {
    if (!isActive()) {
      return false;
    }

    const removed = entity.deleteOne(id);
    refreshValue();
    return removed;
  };

  const deleteMany = (ids: readonly TEntityId[]): readonly TEntityId[] => {
    if (!isActive()) {
      return [];
    }

    const removedIds = entity.deleteMany(ids);
    refreshValue();
    return removedIds;
  };

  const getValue = (): RResult => {
    if (refreshOnGet) {
      refreshValue();
    }

    return readValue();
  };

  return {
    upsertOne,
    upsertMany,
    deleteOne,
    deleteMany,
    getValue,
  };
};
