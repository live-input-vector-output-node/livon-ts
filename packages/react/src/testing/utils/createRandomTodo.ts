import { randomString } from '../randomData.js';

import type { CreateRandomTodoInput, Todo } from './types.js';

export const createRandomTodo = (input: CreateRandomTodoInput = {}): Todo => {
  const idPrefix = input.idPrefix ?? 'todo-id';
  const titlePrefix = input.titlePrefix ?? 'todo-title';

  return {
    id: randomString({ prefix: idPrefix }),
    title: randomString({ prefix: titlePrefix }),
  };
};
