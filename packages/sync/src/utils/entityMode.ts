export interface ModeValueState<
  TId,
  RResult,
> {
  mode: 'one' | 'many';
  hasEntityValue: boolean;
  membershipIds: readonly TId[];
  state: {
    value: RResult;
  };
}

export interface ReadById<
  TId,
  TEntity extends object,
> {
  (id: TId): TEntity | undefined;
}

export const isEntityValue = <TEntity extends object>(
  value: unknown,
): value is TEntity => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

export const isEntityArray = <TEntity extends object>(
  value: unknown,
): value is readonly TEntity[] => {
  return Array.isArray(value) && value.every((entry) => isEntityValue<TEntity>(entry));
};

export const getModeValue = <
  TId,
  TEntity extends object,
  RResult,
  TInternal extends ModeValueState<TId, RResult>,
>(
  internal: TInternal,
  readById: ReadById<TId, TEntity>,
): RResult => {
  if (!internal.hasEntityValue) {
    return internal.state.value;
  }

  if (internal.mode === 'many') {
    const manyValue = internal.membershipIds
      .map((id) => readById(id))
      .filter((entry): entry is TEntity => entry !== undefined);

    return manyValue as RResult;
  }

  if (internal.mode === 'one') {
    const firstId = internal.membershipIds[0];
    const oneValue = firstId ? readById(firstId) ?? null : null;

    return oneValue as RResult;
  }

  return internal.state.value;
};
