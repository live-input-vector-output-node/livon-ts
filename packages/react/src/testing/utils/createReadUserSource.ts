import { source } from '@livon/sync';

import { createRandomUser } from './createRandomUser.js';
import { createUserEntity } from './createUserEntity.js';
import type {
  CreateReadUserSourceInput,
  ReadUserRun,
  ReadUserSource,
  User,
  UserSlug,
} from './types.js';

const defaultReadUserRun: ReadUserRun = async ({ upsertOne }) => {
  upsertOne(createRandomUser());
};

export const createReadUserSource = (
  input: CreateReadUserSourceInput = {},
): ReadUserSource => {
  const entityStore = input.entity ?? createUserEntity();
  const run = input.run ?? defaultReadUserRun;

  return source<UserSlug, undefined, User, User | null>({
    entity: entityStore,
    run,
  });
};
