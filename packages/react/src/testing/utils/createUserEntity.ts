import { entity } from '@livon/sync';

import type { User, UserEntity } from './types.js';

export const createUserEntity = (): UserEntity => {
  return entity<User>({
    idOf: (value) => value.id,
  });
};
