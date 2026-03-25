import { action } from '@livon/sync';

import { createUserEntity } from './createUserEntity.js';
import type {
  CreateCreateUserActionInput,
  CreateUserAction,
  CreateUserRun,
  User,
  UserSlug,
} from './types.js';

const defaultCreateUserRun: CreateUserRun = async ({ payload }) => {
  return payload;
};

export const createCreateUserAction = (
  input: CreateCreateUserActionInput = {},
): CreateUserAction => {
  const entityStore = input.entity ?? createUserEntity();
  const run = input.run ?? defaultCreateUserRun;

  return action<UserSlug, User, User | null>({
    entity: entityStore,
    run,
  });
};
