import type {
  EntityId,
  EntityUnitKeyInput,
  EntityUnitState,
  RegisterEntityUnitInput,
  SetEntityUnitMembershipInput,
} from './types.js';

interface CreateMembershipMethodsInput<TId extends EntityId> {
  unitStateByKey: Map<string, EntityUnitState<TId>>;
  sweepExpiredOrphansIfNeeded: () => void;
  removeUnitKeyFromId: (input: EntityUnitKeyInput<TId>) => void;
  addUnitKeyToId: (input: EntityUnitKeyInput<TId>) => void;
}

export interface MembershipMethods<TId extends EntityId> {
  clearUnitMembership: (key: string) => void;
  registerUnit: (input: RegisterEntityUnitInput) => () => void;
  setUnitMembership: (input: SetEntityUnitMembershipInput<TId>) => void;
}

export const createMembershipMethods = <TId extends EntityId>({
  unitStateByKey,
  sweepExpiredOrphansIfNeeded,
  removeUnitKeyFromId,
  addUnitKeyToId,
}: CreateMembershipMethodsInput<TId>): MembershipMethods<TId> => {
  const clearUnitMembership = (key: string): void => {
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    unitState.membershipIds.forEach((id) => {
      removeUnitKeyFromId({ id, key });
    });
    unitState.membershipIds.clear();
  };

  const unregisterUnit = (key: string): void => {
    clearUnitMembership(key);
    unitStateByKey.delete(key);
  };

  const registerUnit = ({
    key,
    onChange,
  }: RegisterEntityUnitInput): (() => void) => {
    sweepExpiredOrphansIfNeeded();
    unregisterUnit(key);
    unitStateByKey.set(key, {
      onChange,
      membershipIds: new Set<TId>(),
    });

    return () => {
      unregisterUnit(key);
    };
  };

  const setUnitMembership = ({
    key,
    ids,
  }: SetEntityUnitMembershipInput<TId>): void => {
    sweepExpiredOrphansIfNeeded();
    const unitState = unitStateByKey.get(key);
    if (!unitState) {
      return;
    }

    const currentMembershipIds = unitState.membershipIds;
    if (ids.length === 1) {
      const [nextSingleMembershipId] = ids;
      if (nextSingleMembershipId === undefined) {
        return;
      }

      if (currentMembershipIds.size === 1) {
        const currentSingleMembershipId = currentMembershipIds.values().next().value;
        if (currentSingleMembershipId === nextSingleMembershipId) {
          return;
        }

        if (currentSingleMembershipId !== undefined) {
          removeUnitKeyFromId({
            id: currentSingleMembershipId,
            key,
          });
        }

        currentMembershipIds.clear();
        currentMembershipIds.add(nextSingleMembershipId);
        addUnitKeyToId({
          id: nextSingleMembershipId,
          key,
        });
        return;
      }

      currentMembershipIds.forEach((id) => {
        if (id === nextSingleMembershipId) {
          return;
        }

        removeUnitKeyFromId({ id, key });
      });

      const hasNextSingleMembershipId = currentMembershipIds.has(nextSingleMembershipId);
      currentMembershipIds.clear();
      currentMembershipIds.add(nextSingleMembershipId);
      if (!hasNextSingleMembershipId) {
        addUnitKeyToId({
          id: nextSingleMembershipId,
          key,
        });
      }
      return;
    }

    if (currentMembershipIds.size === ids.length) {
      const hasDifferentId = ids.some((id) => !currentMembershipIds.has(id));
      if (!hasDifferentId) {
        return;
      }
    }

    const nextMembershipIds = new Set<TId>(ids);

    currentMembershipIds.forEach((id) => {
      if (!nextMembershipIds.has(id)) {
        removeUnitKeyFromId({ id, key });
      }
    });

    nextMembershipIds.forEach((id) => {
      if (!currentMembershipIds.has(id)) {
        addUnitKeyToId({ id, key });
      }
    });

    unitState.membershipIds = nextMembershipIds;
  };

  return {
    clearUnitMembership,
    registerUnit,
    setUnitMembership,
  };
};
