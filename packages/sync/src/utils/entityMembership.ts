import { type Entity, type EntityId } from '../entity.js';

export type EntityMembershipMode = 'one' | 'many';

export interface EntityMembershipState<TId extends EntityId> {
  key: string;
  mode: EntityMembershipMode;
  modeLocked: boolean;
  hasEntityValue: boolean;
  membershipIds: readonly TId[];
}

export interface SetOneEntityMembershipInput<
  TEntity extends object,
  TId extends EntityId,
> {
  entity: Entity<TEntity, TId>;
  value: TEntity;
  operation?: string;
}

export interface SetManyEntityMembershipInput<
  TEntity extends object,
  TId extends EntityId,
> {
  entity: Entity<TEntity, TId>;
  values: readonly TEntity[];
  operation?: string;
}

export interface ClearEntityMembershipInput {
  clearUnitMembership: (key: string) => void;
}

interface ResolveLockedModeInput<
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
> {
  state: TState;
  nextMode: EntityMembershipMode;
  operation: string;
}

const createEntityModeLockError = ({
  key,
  lockedMode,
  nextMode,
  operation,
}: {
  key: string;
  lockedMode: EntityMembershipMode;
  nextMode: EntityMembershipMode;
  operation: string;
}): Error => {
  return new Error(
    `[livon/sync] Entity mode is locked for scope unit '${key}' as '${lockedMode}'. `
      + `Cannot switch to '${nextMode}' via ${operation}.`,
  );
};

const resolveLockedMode = <
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
>({
  state,
  nextMode,
  operation,
}: ResolveLockedModeInput<TId, TState>): void => {
  if (state.modeLocked && state.mode !== nextMode) {
    throw createEntityModeLockError({
      key: state.key,
      lockedMode: state.mode,
      nextMode,
      operation,
    });
  }

  if (!state.modeLocked) {
    state.mode = nextMode;
    state.modeLocked = true;
  }
};

export const setOneEntityMembership = <
  TEntity extends object,
  TId extends EntityId,
  TState extends EntityMembershipState<TId>,
>(
  state: TState,
  {
    entity,
    value,
    operation = 'entity write',
  }: SetOneEntityMembershipInput<TEntity, TId>,
): void => {
  resolveLockedMode({
    state,
    nextMode: 'one',
    operation,
  });

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
    operation = 'entity write',
  }: SetManyEntityMembershipInput<TEntity, TId>,
): void => {
  resolveLockedMode({
    state,
    nextMode: 'many',
    operation,
  });

  const currentMembershipIds = state.membershipIds;
  const membershipIds: readonly TId[] = values.map((entry) => entity.idOf(entry));
  const isUnchanged = state.hasEntityValue
    && state.mode === 'many'
    && currentMembershipIds.length === membershipIds.length
    && currentMembershipIds.every((id, index) => id === membershipIds[index]);

  if (isUnchanged) {
    return;
  }

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
