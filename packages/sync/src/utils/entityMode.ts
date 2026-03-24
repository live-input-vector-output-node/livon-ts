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

export function getModeValue<
  TId,
  TEntity extends object,
>(
  internal: ModeValueState<TId, readonly TEntity[]> & {
    mode: 'many';
    hasEntityValue: true;
  },
  readById: ReadById<TId, TEntity>,
): readonly TEntity[];
export function getModeValue<
  TId,
  TEntity extends object,
>(
  internal: ModeValueState<TId, TEntity | null> & {
    mode: 'one';
    hasEntityValue: true;
  },
  readById: ReadById<TId, TEntity>,
): TEntity | null;
export function getModeValue<
  TId,
  TEntity extends object,
  RResult,
>(
  internal: ModeValueState<TId, RResult>,
  readById: ReadById<TId, TEntity>,
): RResult;
export function getModeValue<
  TId,
  TEntity extends object,
  RResult,
>(
  internal: ModeValueState<TId, RResult>,
  readById: ReadById<TId, TEntity>,
): RResult | readonly TEntity[] | TEntity | null {
  if (!internal.hasEntityValue) {
    return internal.state.value;
  }

  if (internal.mode === 'many') {
    const manyValue = internal.membershipIds
      .map((id) => readById(id))
      .filter((entry): entry is TEntity => entry !== undefined);

    return manyValue;
  }

  if (internal.mode === 'one') {
    const firstId = internal.membershipIds[0];
    const oneValue = firstId ? readById(firstId) ?? null : null;

    return oneValue;
  }

  return internal.state.value;
}
