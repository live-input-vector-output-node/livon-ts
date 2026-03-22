import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { stream, type Stream } from './stream.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface User {
  id: string;
  name: string;
}

interface UserSlug {
  slugId: number;
}

type UsersResult = readonly User[];
type UsersEntity = Entity<User>;
type ReadUsersSource = Source<UserSlug, undefined, UsersResult, UsersResult>;
type UserUpdatedStream = Stream<UserSlug, User, User | null, User>;

describe('stream()', () => {
  let usersEntity: UsersEntity;
  let readUsers: ReadUsersSource;
  let readUsersRunMock = vi.fn();
  let streamRunMock = vi.fn();
  let unsubscribeMock = vi.fn();
  let onUserUpdated: UserUpdatedStream;
  let slugId: number;
  let eventUserId: string;
  let eventUserName: string;

  beforeEach(() => {
    slugId = randomNumber();
    eventUserId = randomString({ prefix: 'event-user-id' });
    eventUserName = randomString({ prefix: 'event-user-name' });

    readUsersRunMock = vi.fn(async ({ upsertMany }) => {
      upsertMany([]);
    });

    usersEntity = entity<User>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readUsers = source<UserSlug, undefined, User, UsersResult, UsersResult>({
      entity: usersEntity,
      run: readUsersRunMock,
    });

    unsubscribeMock = vi.fn();
    streamRunMock = vi.fn(async ({ payload, upsertOne }) => {
      upsertOne(payload, { merge: true });

      return () => {
        unsubscribeMock();
      };
    });

    onUserUpdated = stream<UserSlug, User, User, User | null, User, undefined, UsersResult, UsersResult>({
      entity: usersEntity,
      source: readUsers,
      run: streamRunMock,
    });
  });

  describe('happy', () => {
    it('should expose start function when stream unit is created', () => {
      const streamStore = onUserUpdated({ slugId });

      expect(typeof streamStore.start).toBe('function');
    });

    it('should expose stop function when stream unit is created', () => {
      const streamStore = onUserUpdated({ slugId });

      expect(typeof streamStore.stop).toBe('function');
    });

    it('should call run once when start is invoked once', () => {
      const streamStore = onUserUpdated({ slugId });
      const payload = {
        id: eventUserId,
        name: eventUserName,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup once when stop is invoked after start', async () => {
      const streamStore = onUserUpdated({ slugId });
      const payload = {
        id: eventUserId,
        name: eventUserName,
      };

      streamStore.start(payload);
      await Promise.resolve();
      streamStore.stop();
      await Promise.resolve();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should pass scope to run handler when stream starts', () => {
      const streamStore = onUserUpdated({ slugId });
      const payload = {
        id: eventUserId,
        name: eventUserName,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { slugId } }),
      );
    });

    it('should pass payload to run handler when stream starts', () => {
      const streamStore = onUserUpdated({ slugId });
      const payload = {
        id: eventUserId,
        name: eventUserName,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { id: eventUserId, name: eventUserName } }),
      );
    });

    it('should trigger source reload when run handler uses refetch', async () => {
      streamRunMock = vi.fn(async ({ scope, payload, upsertOne, refetch }) => {
        upsertOne(payload, { merge: true });
        await refetch(scope)();
      });

      onUserUpdated = stream<UserSlug, User, User, User | null, User, undefined, UsersResult, UsersResult>({
        entity: usersEntity,
        source: readUsers,
        run: streamRunMock,
      });

      const streamStore = onUserUpdated({ slugId });
      const payload = {
        id: eventUserId,
        name: eventUserName,
      };

      streamStore.start(payload);
      await Promise.resolve();

      expect(readUsersRunMock).toHaveBeenCalledTimes(1);
    });
  });
});
