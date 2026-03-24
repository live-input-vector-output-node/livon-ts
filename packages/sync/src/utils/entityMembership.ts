import { type Entity, type EntityId } from '../entity.js';

export interface EntityMembershipState<TId extends EntityId> {
  key: string;
  mode: 'one' | 'many';
  hasEntityValue: boolean;
  membershipIds: readonly TId[];
}

export interface SetOneEntityMembershipInput<
  TEntity extends object,
  TId extends EntityId,
> {
  entity: Entity<TEntity, TId>;
  value: TEntity;
}

export interface SetManyEntityMembershipInput<
  TEntity extends object,
  TId extends EntityId,
> {
  entity: Entity<TEntity, TId>;
  values: readonly TEntity[];
}

export interface ClearEntityMembershipInput {
  clearUnitMembership: (key: string) => void;
}

export const setOneEntityMembership = <
  TEntity extends object,
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
>(
  state: TState,
  {
    entity,
    value,
  }: SetOneEntityMembershipInput<TEntity, TId>,
): void => {
  const id = entity.idOf(value);
  const currentMembershipIds = state.membershipIds;
  const currentFirstMembershipId = currentMembershipIds[0];
  const isUnchanged = state.hasEntityValue
    && state.mode === 'one'
    && currentMembershipIds.length === 1
    && currentFirstMembershipId === id;

  if (isUnchanged) {
    return;
  }

  const membershipIds: readonly TId[] = [id];

  state.mode = 'one';
  state.hasEntityValue = true;
  state.membershipIds = membershipIds;
  entity.setUnitMembership({
    key: state.key,
    ids: membershipIds,
  });
};

export const setManyEntityMembership = <
  TEntity extends object,
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
>(
  state: TState,
  {
    entity,
    values,
  }: SetManyEntityMembershipInput<TEntity, TId>,
): void => {
  const currentMembershipIds = state.membershipIds;
  const membershipIds: readonly TId[] = values.map((entry) => entity.idOf(entry));
  const isUnchanged = state.hasEntityValue
    && state.mode === 'many'
    && currentMembershipIds.length === membershipIds.length
    && currentMembershipIds.every((id, index) => id === membershipIds[index]);

  if (isUnchanged) {
    return;
  }

  state.mode = 'many';
  state.hasEntityValue = true;
  state.membershipIds = membershipIds;
  entity.setUnitMembership({
    key: state.key,
    ids: membershipIds,
  });
};

export const clearEntityMembership = <
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
>(
  state: TState,
  {
    clearUnitMembership,
  }: ClearEntityMembershipInput,
): void => {
  state.hasEntityValue = false;
  state.membershipIds = [];
  clearUnitMembership(state.key);
};
