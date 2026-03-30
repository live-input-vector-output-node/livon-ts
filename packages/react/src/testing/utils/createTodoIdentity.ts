import { randomString } from '../randomData.js';

import type { CreateTodoIdentityInput, TodoIdentity } from './types.js';

export const createTodoIdentity = (input: CreateTodoIdentityInput = {}): TodoIdentity => {
  const prefix = input.prefix ?? 'todo-list-id';

  return {
    listId: randomString({ prefix }),
  };
};
