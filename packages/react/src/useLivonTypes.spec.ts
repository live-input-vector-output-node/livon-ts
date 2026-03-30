import { action, entity, source, stream, type UnitStatus } from '@livon/sync';
import { describe, expectTypeOf, it } from 'vitest';

import { useLivonActionState } from './useLivonActionState.js';
import { useLivonMeta } from './useLivonMeta.js';
import { useLivonRun } from './useLivonRun.js';
import { useLivonSourceState } from './useLivonSourceState.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonStreamState } from './useLivonStreamState.js';
import { useLivonValue } from './useLivonValue.js';

interface User {
  id: string;
  name: string;
}

interface UserIdentity {
  templateId: string;
}

interface UserMeta {
  severity: 'info' | 'error';
  text: string;
}

const createUserEntity = () => {
  return entity<User>({
    idOf: (value) => value.id,
  });
};

const createReadUsersSource = (userEntity: ReturnType<typeof createUserEntity>) => {
  return source<UserIdentity, undefined, readonly User[]>({
    entity: userEntity,
    run: async () => {
      return [];
    },
  });
};

const createTypedMetaUnits = () => {
  const userEntity = createUserEntity();
  const readUsers = source<UserIdentity, undefined, readonly User[], UserMeta>({
    entity: userEntity,
    run: async ({ setMeta }) => {
      setMeta({
        severity: 'info',
        text: 'source-meta',
      });
      return [];
    },
  });
  const createUser = action<UserIdentity, User, User | null, UserMeta>({
    entity: userEntity,
    run: async ({ payload, setMeta }) => {
      setMeta({
        severity: 'info',
        text: 'action-meta',
      });
      return payload;
    },
  });
  const onUserUpdated = stream<UserIdentity, User, User | null, UserMeta>({
    entity: userEntity,
    run: async ({ payload, setMeta }) => {
      setMeta({
        severity: 'info',
        text: 'stream-meta',
      });
      return payload;
    },
  });

  return {
    sourceUnit: readUsers({ templateId: 'typed-meta-source' }),
    actionUnit: createUser({ templateId: 'typed-meta-action' }),
    streamUnit: onUserUpdated({ templateId: 'typed-meta-stream' }),
  };
};

describe('hook type inference', () => {
  it('should infer source value and run types when source unit is passed to hooks', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);

    const unit = readUsers({ templateId: 't1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);
    const resolveRun = (currentUnit: typeof unit) => useLivonRun(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => readonly User[]>();
    expectTypeOf(resolveRun).toEqualTypeOf<
      (
        currentUnit: typeof unit,
      ) => typeof unit.run
    >();
  });

  it('should infer action value and run types when action unit is passed to hooks', () => {
    const userEntity = createUserEntity();

    const createUser = action<UserIdentity, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = createUser({ templateId: 't1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);
    const resolveRun = (currentUnit: typeof unit) => useLivonRun(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => User | null>();
    expectTypeOf(resolveRun).toEqualTypeOf<
      (
        currentUnit: typeof unit,
      ) => typeof unit.run
    >();
  });

  it('should infer stream run type when stream unit is passed to hooks', () => {
    const userEntity = createUserEntity();

    const onUserUpdated = stream<UserIdentity, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = onUserUpdated({ templateId: 't1' });
    const resolveRun = (currentUnit: typeof unit) => useLivonRun(currentUnit);

    expectTypeOf(resolveRun).toEqualTypeOf<
      (
        currentUnit: typeof unit,
      ) => typeof unit.run
    >();
  });

  it('should infer status and meta types when source unit snapshot is used by hooks', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);

    const unit = readUsers({ templateId: 't1' });
    const resolveStatus = (currentUnit: typeof unit) => useLivonStatus(currentUnit);
    const resolveMeta = (currentUnit: typeof unit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveStatus).toEqualTypeOf<
      (currentUnit: typeof unit) => UnitStatus
    >();
    expectTypeOf(resolveMeta).toEqualTypeOf<(currentUnit: typeof unit) => unknown>();
  });

  it('should preserve explicit source meta type in useLivonMeta', () => {
    const { sourceUnit } = createTypedMetaUnits();
    const resolveSourceMeta = (currentUnit: typeof sourceUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveSourceMeta).toEqualTypeOf<
      (currentUnit: typeof sourceUnit) => UserMeta | null
    >();
  });

  it('should preserve explicit source meta type in useLivonState', () => {
    const { sourceUnit } = createTypedMetaUnits();
    const resolveSourceState = (currentUnit: typeof sourceUnit) => useLivonState(currentUnit);

    expectTypeOf(resolveSourceState).toEqualTypeOf<
      (currentUnit: typeof sourceUnit) => {
        value: readonly User[];
        status: UnitStatus;
        meta: UserMeta | null;
      }
    >();
  });

  it('should preserve explicit action meta type in useLivonMeta', () => {
    const { actionUnit } = createTypedMetaUnits();
    const resolveActionMeta = (currentUnit: typeof actionUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveActionMeta).toEqualTypeOf<
      (currentUnit: typeof actionUnit) => UserMeta | null
    >();
  });

  it('should preserve explicit action meta type in useLivonState', () => {
    const { actionUnit } = createTypedMetaUnits();
    const resolveActionState = (currentUnit: typeof actionUnit) => useLivonState(currentUnit);

    expectTypeOf(resolveActionState).toEqualTypeOf<
      (currentUnit: typeof actionUnit) => {
        value: User | null;
        status: UnitStatus;
        meta: UserMeta | null;
      }
    >();
  });

  it('should preserve explicit stream meta type in useLivonMeta', () => {
    const { streamUnit } = createTypedMetaUnits();
    const resolveStreamMeta = (currentUnit: typeof streamUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveStreamMeta).toEqualTypeOf<
      (currentUnit: typeof streamUnit) => UserMeta | null
    >();
  });

  it('should preserve explicit stream meta type in useLivonState', () => {
    const { streamUnit } = createTypedMetaUnits();
    const resolveStreamState = (currentUnit: typeof streamUnit) => useLivonState(currentUnit);

    expectTypeOf(resolveStreamState).toEqualTypeOf<
      (currentUnit: typeof streamUnit) => {
        value: User | null;
        status: UnitStatus;
        meta: UserMeta | null;
      }
    >();
  });

  it('should infer grouped source state shape with run only', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);
    const unit = readUsers({ templateId: 't1' });
    const resolveSourceState = (currentUnit: typeof unit) => useLivonSourceState(currentUnit);
    type SourceState = ReturnType<typeof resolveSourceState>;
    void unit;
    void resolveSourceState;

    expectTypeOf<SourceState['value']>().toEqualTypeOf<readonly User[]>();
    expectTypeOf<SourceState['status']>().toEqualTypeOf<UnitStatus>();
    expectTypeOf<SourceState['meta']>().toEqualTypeOf<unknown>();
    expectTypeOf<SourceState['run']>().toEqualTypeOf<typeof unit.run>();
  });

  it('should infer grouped action state shape with run only', () => {
    const userEntity = createUserEntity();
    const createUser = action<UserIdentity, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = createUser({ templateId: 't1' });
    const resolveActionState = (currentUnit: typeof unit) => useLivonActionState(currentUnit);
    type ActionState = ReturnType<typeof resolveActionState>;
    void unit;
    void resolveActionState;

    expectTypeOf<ActionState['value']>().toEqualTypeOf<User | null>();
    expectTypeOf<ActionState['status']>().toEqualTypeOf<UnitStatus>();
    expectTypeOf<ActionState['meta']>().toEqualTypeOf<unknown>();
    expectTypeOf<ActionState['run']>().toEqualTypeOf<typeof unit.run>();
  });

  it('should infer grouped stream state shape with run only', () => {
    const userEntity = createUserEntity();
    const onUserUpdated = stream<UserIdentity, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = onUserUpdated({ templateId: 't1' });
    const resolveStreamState = (currentUnit: typeof unit) => useLivonStreamState(currentUnit);
    type StreamState = ReturnType<typeof resolveStreamState>;
    void unit;
    void resolveStreamState;

    expectTypeOf<StreamState['value']>().toEqualTypeOf<User | null>();
    expectTypeOf<StreamState['status']>().toEqualTypeOf<UnitStatus>();
    expectTypeOf<StreamState['meta']>().toEqualTypeOf<unknown>();
    expectTypeOf<StreamState['run']>().toEqualTypeOf<typeof unit.run>();
  });
});
