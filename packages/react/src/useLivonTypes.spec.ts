import { action, entity, source, stream } from '@livon/sync';
import { describe, expectTypeOf, it } from 'vitest';

import { useLivonDraft } from './useLivonDraft.js';
import { useLivonMeta } from './useLivonMeta.js';
import { useLivonRun } from './useLivonRun.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonStop } from './useLivonStop.js';
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
  return source<UserSlug, undefined, User, readonly User[]>({
    entity: userEntity,
    run: async ({ upsertMany }) => {
      upsertMany([]);
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

    const createUser = action<UserSlug, User, User, User | null, User>({
      entity: userEntity,
      run: async ({ payload, upsertOne }) => {
        upsertOne(payload);
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

    const onUserUpdated = stream<UserSlug, User, User, User | null>({
      entity: userEntity,
      run: async ({ payload, upsertOne }) => {
        upsertOne(payload);

        return () => undefined;
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
      (currentUnit: typeof unit) => 'idle' | 'loading' | 'success' | 'error'
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
});
