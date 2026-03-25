import { stream } from '@livon/sync';

import { createUserEntity } from './createUserEntity.js';
import type {
  CreateUserUpdatedStreamInput,
  User,
  UserSlug,
  UserUpdatedRun,
  UserUpdatedStream,
} from './types.js';

const defaultUserUpdatedRun: UserUpdatedRun = async ({ payload }) => {
  return payload ?? null;
};

export const createUserUpdatedStream = (
  input: CreateUserUpdatedStreamInput = {},
): UserUpdatedStream => {
  const entityStore = input.entity ?? createUserEntity();
  const run = input.run ?? defaultUserUpdatedRun;

  return stream<UserSlug, User, User | null>({
    entity: entityStore,
    run,
  });
};
