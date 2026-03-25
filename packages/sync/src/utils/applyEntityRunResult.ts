import { type Entity, type EntityId } from '../entity.js';
import {
  clearEntityMembership,
  setManyEntityMembership,
  setOneEntityMembership,
  type EntityMembershipState,
} from './entityMembership.js';
import { isEntityArray, isEntityValue } from './entityMode.js';

export interface ApplyEntityRunResultInput<
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
  TState extends EntityMembershipState<TEntityId>,
> {
  entity: Entity<TEntity, TEntityId>;
  state: TState;
  nextValue: RResult | void;
  refreshValueFromMembership: () => void;
  setRawValue: (value: RResult) => void;
  upsertOneOperation?: string;
  upsertManyOperation?: string;
}

const DEFAULT_UPSERT_ONE_OPERATION = 'run() result object';
const DEFAULT_UPSERT_MANY_OPERATION = 'run() result array';

export const applyEntityRunResult = <
  TEntity extends object,
  RResult,
  TEntityId extends EntityId,
  TState extends EntityMembershipState<TEntityId>,
>({
  entity,
  state,
  nextValue,
  refreshValueFromMembership,
  setRawValue,
  upsertOneOperation = DEFAULT_UPSERT_ONE_OPERATION,
  upsertManyOperation = DEFAULT_UPSERT_MANY_OPERATION,
}: ApplyEntityRunResultInput<TEntity, RResult, TEntityId, TState>): void => {
  if (nextValue === undefined) {
    refreshValueFromMembership();
    return;
  }

  if (isEntityArray<TEntity>(nextValue)) {
    const upsertedEntities = entity.upsertMany(nextValue);
    setManyEntityMembership(state, {
      entity,
      values: upsertedEntities,
      operation: upsertManyOperation,
    });
    refreshValueFromMembership();
    return;
  }

  if (isEntityValue<TEntity>(nextValue)) {
    const upsertedEntity = entity.upsertOne(nextValue);
    setOneEntityMembership(state, {
      entity,
      value: upsertedEntity,
      operation: upsertOneOperation,
    });
    refreshValueFromMembership();
    return;
  }

  clearEntityMembership(state, {
    clearUnitMembership: entity.clearUnitMembership,
  });
  setRawValue(nextValue);
};
