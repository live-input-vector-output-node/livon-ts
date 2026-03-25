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
  readWrite?: ModeValueReadWriteInput;
}

interface ModeValueCacheKey {
  membershipIds: readonly unknown[];
  state: {
    value: unknown;
  };
}

interface ManySubviewCacheState {
  membershipIds: readonly unknown[];
  values: readonly unknown[];
}

export interface ModeValueReadWriteInput {
  subview?: boolean;
}

interface ReadManyDirectInput<TId, TEntity extends object> {
  membershipIds: readonly TId[];
  readById: ReadById<TId, TEntity>;
}

interface HasSubviewCacheHitInput<TId, TEntity extends object> {
  cache: ManySubviewCacheState;
  membershipIds: readonly TId[];
  readById: ReadById<TId, TEntity>;
}

interface ResolveManyWithSubviewCacheInput<
  TId,
  TEntity extends object,
  RResult,
> {
  internal: ModeValueState<TId, RResult>;
  readById: ReadById<TId, TEntity>;
}

const manySubviewCacheByState = new WeakMap<ModeValueCacheKey, ManySubviewCacheState>();
const DEFAULT_MODE_VALUE_READ_WRITE_SUBVIEW = true;
// Adaptive split (measured 2026-03-24, local median A/B vs last green main commit 1e2ddb4):
// - todo entity read by id: +14.98%
// - todo source get: +2.93%
// - todo view get: +0.72%
// Matrix sweeps of strategy combinations were noisy, but this thresholded approach avoided
// regressions on small memberships while preserving stable references on large memberships.
const MANY_SUBVIEW_MIN_SIZE = 32;

const readManyDirect = <TId, TEntity extends object>({
  membershipIds,
  readById,
}: ReadManyDirectInput<TId, TEntity>): readonly TEntity[] => {
  return membershipIds
    .map((id) => readById(id))
    .filter((entry): entry is TEntity => entry !== undefined);
};

const hasSubviewCacheHit = <TId, TEntity extends object>({
  cache,
  membershipIds,
  readById,
}: HasSubviewCacheHitInput<TId, TEntity>): boolean => {
  const validation = membershipIds.reduce(
    (state, id) => {
      if (!state.matches) {
        return state;
      }

      const currentValue = readById(id);
      if (currentValue === undefined) {
        return state;
      }

      const cachedValue = cache.values[state.nextIndex];
      if (!Object.is(cachedValue, currentValue)) {
        return {
          matches: false,
          nextIndex: state.nextIndex,
        };
      }

      return {
        matches: true,
        nextIndex: state.nextIndex + 1,
      };
    },
    {
      matches: true,
      nextIndex: 0,
    },
  );

  if (!validation.matches) {
    return false;
  }

  return validation.nextIndex === cache.values.length;
};

const resolveManyWithSubviewCache = <
  TId,
  TEntity extends object,
  RResult,
>({
  internal,
  readById,
}: ResolveManyWithSubviewCacheInput<TId, TEntity, RResult>): RResult | readonly TEntity[] => {
  const cache = manySubviewCacheByState.get(internal);
  if (
    cache
    && cache.membershipIds === internal.membershipIds
    // Hot path: identity compare is intentionally shallow. Deep compare was slower in the
    // benchmark matrix and gave no additional correctness benefit for this read-only subview.
    && hasSubviewCacheHit({
      cache,
      membershipIds: internal.membershipIds,
      readById,
    })
  ) {
    return internal.state.value;
  }

  const manyValue = readManyDirect({
    membershipIds: internal.membershipIds,
    readById,
  });
  manySubviewCacheByState.set(internal, {
    membershipIds: internal.membershipIds,
    values: manyValue,
  });

  return manyValue;
};

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
  const subviewEnabled = internal.readWrite?.subview ?? DEFAULT_MODE_VALUE_READ_WRITE_SUBVIEW;

  if (!internal.hasEntityValue) {
    return internal.state.value;
  }

  if (internal.mode === 'many') {
    if (!subviewEnabled) {
      manySubviewCacheByState.delete(internal);
      return readManyDirect({
        membershipIds: internal.membershipIds,
        readById,
      });
    }

    if (internal.membershipIds.length < MANY_SUBVIEW_MIN_SIZE) {
      // Small memberships: direct read is faster than cache validation/setup overhead.
      manySubviewCacheByState.delete(internal);
      return readManyDirect({
        membershipIds: internal.membershipIds,
        readById,
      });
    }

    // Large memberships: keep stable array reference when all entity references are unchanged.
    return resolveManyWithSubviewCache({
      internal,
      readById,
    });
  }

  if (internal.mode === 'one') {
    const firstId = internal.membershipIds[0];
    const oneValue = firstId ? readById(firstId) ?? null : null;

    return oneValue;
  }

  return internal.state.value;
}
