import { entity } from '@livon/sync';

import type { Todo, TodoEntity } from './types.js';

let todoEntitySequence = 0;

export const createTodoEntity = (): TodoEntity => {
  todoEntitySequence += 1;

  return entity<Todo>({
    key: `react-todo-entity-${todoEntitySequence}`,
    idOf: (value) => value.id,
    ttl: 60_000,
  });
};
