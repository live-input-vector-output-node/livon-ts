import { source } from '@livon/sync';

import { createRandomTodo } from './createRandomTodo.js';
import { createTodoEntity } from './createTodoEntity.js';
import type {
  CreateReadTodoSourceInput,
  ReadTodoRun,
  ReadTodoSource,
  TodoIdentity,
} from './types.js';

let readTodoSourceSequence = 0;

const defaultReadTodoRun: ReadTodoRun = ({ set }) => {
  set(createRandomTodo());
};

export const createReadTodoSource = (
  input: CreateReadTodoSourceInput = {},
): ReadTodoSource => {
  readTodoSourceSequence += 1;
  const entityStore = input.entity ?? createTodoEntity();
  const run = input.run ?? defaultReadTodoRun;

  return source({
    entity: entityStore,
    mode: 'one',
  })<TodoIdentity, undefined>({
    key: `react-read-todo-source-${readTodoSourceSequence}`,
    defaultValue: null,
    run,
  });
};
