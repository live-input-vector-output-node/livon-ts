import { randomString } from '../randomData.js';

import type { CreateRandomUserInput, User } from './types.js';

export const createRandomUser = (input: CreateRandomUserInput = {}): User => {
  const idPrefix = input.idPrefix ?? 'user-id';
  const namePrefix = input.namePrefix ?? 'user-name';

  return {
    id: randomString({ prefix: idPrefix }),
    name: randomString({ prefix: namePrefix }),
  };
};
