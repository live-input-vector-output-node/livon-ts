import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { stream, type Stream } from './stream.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

interface MessageMeta {
  severity: string;
  text: string;
}

type UnitStatus = 'idle' | 'loading' | 'success' | 'error';
type UsersEntity = Entity<User>;
type UserUpdatedStream = Stream<UserSlug, User, User | null, User>;

describe('stream() branches', () => {
  let usersEntity: UsersEntity;
  let onUserUpdated: UserUpdatedStream;
  let streamRunMock = vi.fn();
  let unsubscribeMock = vi.fn();
  let slugId: number;
  let eventUserId: string;
  let eventUserName: string;

  beforeEach(() => {
    slugId = randomNumber();
    eventUserId = randomString({ prefix: 'event-user-id' });
    eventUserName = randomString({ prefix: 'event-user-name' });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    unsubscribeMock = vi.fn();
    streamRunMock = vi.fn(async ({ payload, entity }) => {
      entity.upsertOne(payload, { merge: true });

      return () => {
        unsubscribeMock();
      };
    });

    onUserUpdated = stream<UserSlug, User, User, User | null, User>({
      entity: usersEntity,
      run: streamRunMock,
    });
  });

  describe('happy', () => {
    it('should return same stream unit instance when scope is identical', () => {
      const firstUnit = onUserUpdated({ slugId });
      const secondUnit = onUserUpdated({ slugId });

      expect(firstUnit).toBe(secondUnit);
    });

    it('should call run once when start is invoked repeatedly without stop', () => {
      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenCalledTimes(1);
    });

    it('should not call cleanup when stop is invoked before start', () => {
      const streamStore = onUserUpdated({ slugId });

      streamStore.stop();

      expect(unsubscribeMock).not.toHaveBeenCalled();
    });

    it('should update entity-backed value when set is called', () => {
      const streamStore = onUserUpdated({ slugId });
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      streamStore.set(setUser);

      expect(streamStore.get()).toEqual(setUser);
    });

    it('should remove effect listener when cleanup is called', () => {
      const streamStore = onUserUpdated({ slugId });
      const listener = vi.fn();
      const remove = streamStore.effect(listener);
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      remove?.();
      streamStore.set(setUser);

      expect(listener).not.toHaveBeenCalled();
    });

    it('should execute cleanup returned by run when stop is called', async () => {
      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      await Promise.resolve();
      streamStore.stop();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should execute cleanup immediately when run resolves after stop', async () => {
      const lateCleanup = vi.fn();

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          await Promise.resolve();

          return () => {
            lateCleanup();
          };
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      streamStore.stop();
      await Promise.resolve();
      await Promise.resolve();

      expect(lateCleanup).toHaveBeenCalledTimes(1);
    });

    it('should ignore direct run return value when run does not upsert entities', async () => {
      const returnedUser: User = {
        id: randomString({ prefix: 'returned-id' }),
        name: randomString({ prefix: 'returned-name' }),
      };

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          return returnedUser;
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      await Promise.resolve();

      expect(streamStore.get()).toBeNull();
    });

    it('should return many-mode value when run calls upsertMany', async () => {
      const onUsersUpdated = stream<UserSlug, readonly User[], User, readonly User[], readonly User[]>({
        entity: usersEntity,
        run: async ({ payload, entity }) => {
          entity.upsertMany(payload, { merge: true });
        },
      });
      const firstUser: User = {
        id: randomString({ prefix: 'first-id' }),
        name: randomString({ prefix: 'first-name' }),
      };
      const secondUser: User = {
        id: randomString({ prefix: 'second-id' }),
        name: randomString({ prefix: 'second-name' }),
      };
      const streamStore = onUsersUpdated({ slugId });

      streamStore.start([firstUser, secondUser]);
      await Promise.resolve();

      expect(streamStore.get()).toEqual([firstUser, secondUser]);
    });

    it('should remove records when run calls removeOne and removeMany', async () => {
      const firstUserId = randomString({ prefix: 'first-user-id' });
      const secondUserId = randomString({ prefix: 'second-user-id' });
      const thirdUserId = randomString({ prefix: 'third-user-id' });
      const firstUserName = randomString({ prefix: 'first-user-name' });
      const secondUserName = randomString({ prefix: 'second-user-name' });
      const thirdUserName = randomString({ prefix: 'third-user-name' });
      const firstUser: User = { id: firstUserId, name: firstUserName };
      const secondUser: User = { id: secondUserId, name: secondUserName };
      const thirdUser: User = { id: thirdUserId, name: thirdUserName };

      const onUsersUpdated = stream<UserSlug, readonly User[], User, readonly User[], readonly User[]>({
        entity: usersEntity,
        run: async ({ payload, entity }) => {
          entity.upsertMany(payload, { merge: true });
          entity.removeOne(firstUserId);
          entity.removeMany([secondUserId]);
        },
      });
      const streamStore = onUsersUpdated({ slugId });

      streamStore.start([firstUser, secondUser, thirdUser]);
      await Promise.resolve();

      expect(streamStore.get()).toEqual([thirdUser]);
    });

    it('should not expose refetch in run context', async () => {
      let hasRefetch = true;

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async (context) => {
          hasRefetch = Object.prototype.hasOwnProperty.call(context, 'refetch');
          context.entity.upsertOne(context.payload, { merge: true });
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      await Promise.resolve();

      expect(hasRefetch).toBe(false);
    });

    it('should read current value when run calls getValue', async () => {
      let valueFromRun: User | null = {
        id: randomString({ prefix: 'seed-id' }),
        name: randomString({ prefix: 'seed-name' }),
      };

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async ({ getValue, payload, entity }) => {
          valueFromRun = getValue();
          entity.upsertOne(payload, { merge: true });
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      await Promise.resolve();

      expect(valueFromRun).toBeNull();
    });

    it('should expose latest meta when run calls setMeta', async () => {
      const meta: MessageMeta = {
        severity: randomString({ prefix: 'severity' }),
        text: randomString({ prefix: 'meta-text' }),
      };
      const metas: unknown[] = [];

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async ({ setMeta, payload, entity }) => {
          setMeta(meta);
          entity.upsertOne(payload, { merge: true });
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.effect((snapshot) => {
        metas.push(snapshot.meta);
      });

      streamStore.start(payload);
      await Promise.resolve();

      expect(metas).toContainEqual(meta);
    });
  });

  describe('sad', () => {
    it('should set error status when run rejects', async () => {
      const statuses: UnitStatus[] = [];
      const errorMessage = randomString({ prefix: 'run-error' });

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          throw new Error(errorMessage);
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.effect((snapshot) => {
        statuses.push(snapshot.status);
      });

      streamStore.start(payload);
      await Promise.resolve();
      await Promise.resolve();

      expect(statuses).toContain('error');
    });

    it('should ignore set when stream unit was destroyed', () => {
      const streamStore = onUserUpdated({ slugId });
      const setUser: User = {
        id: randomString({ prefix: 'set-id' }),
        name: randomString({ prefix: 'set-name' }),
      };

      streamStore.destroy();
      streamStore.set(setUser);

      expect(streamStore.get()).toBeNull();
    });

    it('should return undefined from effect when stream unit was destroyed', () => {
      const streamStore = onUserUpdated({ slugId });

      streamStore.destroy();
      const remove = streamStore.effect(vi.fn());

      expect(remove).toBeUndefined();
    });

    it('should call cleanup once when destroy is invoked repeatedly', async () => {
      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.start(payload);
      await Promise.resolve();
      streamStore.destroy();
      streamStore.destroy();
      await Promise.resolve();
      await Promise.resolve();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should not call run handler when start is invoked after destroy', () => {
      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.destroy();
      streamStore.start(payload);

      expect(streamRunMock).not.toHaveBeenCalled();
    });

    it('should keep meta unchanged and expose error in context when run throws', async () => {
      const metas: unknown[] = [];
      const contexts: unknown[] = [];
      const errorMeta: MessageMeta = {
        severity: randomString({ prefix: 'severity' }),
        text: randomString({ prefix: 'text' }),
      };

      onUserUpdated = stream<UserSlug, User, User, User | null, User>({
        entity: usersEntity,
        run: async () => {
          throw errorMeta;
        },
      });

      const payload = { id: eventUserId, name: eventUserName };
      const streamStore = onUserUpdated({ slugId });

      streamStore.effect((snapshot) => {
        metas.push(snapshot.meta);
        contexts.push(snapshot.context);
      });

      streamStore.start(payload);
      await Promise.resolve();
      await Promise.resolve();

      expect(metas).not.toContainEqual(errorMeta);
      expect(contexts).toContainEqual(errorMeta);
    });
  });
});
