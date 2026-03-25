import { action, entity, source, stream, type UnitStatus } from '@livon/sync';
import { describe, expectTypeOf, it } from 'vitest';

import { useLivonActionState } from './useLivonActionState.js';
import { useLivonDraft } from './useLivonDraft.js';
import { useLivonMeta } from './useLivonMeta.js';
import { useLivonRun } from './useLivonRun.js';
import { useLivonSourceState } from './useLivonSourceState.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonStop } from './useLivonStop.js';
import { useLivonStreamState } from './useLivonStreamState.js';
import { useLivonValue } from './useLivonValue.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  templateId: string;
}

interface UpdateUser {
  (input: User): User;
}

interface UpdateUndefined {
  (input: undefined): undefined;
}

const createUserEntity = () => {
  return entity<User>({
    idOf: (value) => value.id,
  });
};

const createReadUsersSource = (userEntity: ReturnType<typeof createUserEntity>) => {
  return source<UserSlug, undefined, readonly User[]>({
    entity: userEntity,
    run: async () => {
      return [];
    },
  });
};

describe('hook type inference', () => {
  it('should infer source value and run types when source unit is passed to hooks', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);

    const unit = readUsers({ templateId: 't1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);
    const resolveRun = (currentUnit: typeof unit) => useLivonRun(currentUnit);
    const resolveStop = (currentUnit: typeof unit) => useLivonStop(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => readonly User[]>();
    expectTypeOf(resolveRun).toEqualTypeOf<
      (
        currentUnit: typeof unit,
      ) => (payloadInput?: undefined | UpdateUndefined) => Promise<readonly User[]>
    >();
    expectTypeOf(resolveStop).toEqualTypeOf<(currentUnit: typeof unit) => () => void>();
  });

  it('should infer action value and run types when action unit is passed to hooks', () => {
    const userEntity = createUserEntity();

    const createUser = action<UserSlug, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = createUser({ templateId: 't1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);
    const resolveRun = (currentUnit: typeof unit) => useLivonRun(currentUnit);
    const resolveStop = (currentUnit: typeof unit) => useLivonStop(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => User | null>();
    expectTypeOf(resolveRun).toEqualTypeOf<
      (
        currentUnit: typeof unit,
      ) => (payloadInput?: User | UpdateUser) => Promise<User | null>
    >();
    expectTypeOf(resolveStop).toEqualTypeOf<(currentUnit: typeof unit) => () => void>();
  });

  it('should infer stream run and stop types when stream unit is passed to hooks', () => {
    const userEntity = createUserEntity();

    const onUserUpdated = stream<UserSlug, User, User | null>({
      entity: userEntity,
      run: async ({ payload }) => {
        return payload;
      },
    });

    const unit = onUserUpdated({ templateId: 't1' });
    const resolveStop = (currentUnit: typeof unit) => useLivonStop(currentUnit);

    expectTypeOf(resolveStop).toEqualTypeOf<(currentUnit: typeof unit) => () => void>();
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

  it('should infer draft tuple types when source unit is passed to useLivonDraft', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);
    const unit = readUsers({ templateId: 't1' });
    const resolveDraft = (currentUnit: typeof unit) => useLivonDraft(currentUnit);

    expectTypeOf(resolveDraft).toEqualTypeOf<
      (currentUnit: typeof unit) => [
        (input: readonly User[] | ((value: readonly User[]) => readonly User[])) => void,
        () => void,
      ]
    >();
  });

  it('should infer grouped state shape when source unit is passed to useLivonState', () => {
    const userEntity = createUserEntity();
    const readUsers = createReadUsersSource(userEntity);
    const unit = readUsers({ templateId: 't1' });
    const resolveState = (currentUnit: typeof unit) => useLivonState(currentUnit);

    expectTypeOf(resolveState).toEqualTypeOf<
      (currentUnit: typeof unit) => {
        value: readonly User[];
        status: UnitStatus;
        meta: unknown;
      }
    >();
  });

  it('should infer grouped source state shape including draft API', () => {
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
    expectTypeOf<SourceState['run']>().toEqualTypeOf<
      (payloadInput?: undefined | UpdateUndefined) => Promise<readonly User[]>
    >();
    expectTypeOf<SourceState['refetch']>().toEqualTypeOf<
      (payloadInput?: undefined | UpdateUndefined) => Promise<readonly User[]>
    >();
    expectTypeOf<SourceState['force']>().toEqualTypeOf<
      (payloadInput?: undefined | UpdateUndefined) => Promise<readonly User[]>
    >();
    expectTypeOf<SourceState['reset']>().toEqualTypeOf<() => void>();
    expectTypeOf<SourceState['stop']>().toEqualTypeOf<() => void>();
    expectTypeOf<SourceState['draft']['set']>().toEqualTypeOf<
      (input: readonly User[] | ((value: readonly User[]) => readonly User[])) => void
    >();
    expectTypeOf<SourceState['draft']['clean']>().toEqualTypeOf<() => void>();
  });

  it('should infer grouped action state shape', () => {
    const userEntity = createUserEntity();
    const createUser = action<UserSlug, User, User | null>({
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
    expectTypeOf<ActionState['run']>().toEqualTypeOf<
      (payloadInput?: User | UpdateUser) => Promise<User | null>
    >();
    expectTypeOf<ActionState['stop']>().toEqualTypeOf<() => void>();
  });

  it('should infer grouped stream state shape', () => {
    const userEntity = createUserEntity();
    const onUserUpdated = stream<UserSlug, User, User | null>({
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
    expectTypeOf<StreamState['start']>().toEqualTypeOf<
      (payloadInput?: User | UpdateUser) => void
    >();
    expectTypeOf<StreamState['stop']>().toEqualTypeOf<() => void>();
  });
});
