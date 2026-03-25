import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoScope {
  listId: number;
}

interface TodoQueryPayload {
  query: string;
}

type TodosResult = readonly Todo[];
type TodosEntity = Entity<Todo>;
type ReadTodosSource = Source<TodoScope, TodoQueryPayload, TodosResult>;

describe('source.refetch()', () => {
  let runMock = vi.fn();
  let todosEntity: TodosEntity;
  let readTodos: ReadTodosSource;
  let listId: number;
  let queryValue: string;

  beforeEach(() => {
    listId = randomNumber();
    queryValue = randomString({ prefix: 'query' });

    runMock = vi.fn(async ({ payload }) => {
      return [{ id: payload.query, title: payload.query }];
    });

    todosEntity = entity<Todo>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readTodos = source<TodoScope, TodoQueryPayload, TodosResult>({
      entity: todosEntity,
      run: runMock,
    });
  });

  describe('happy', () => {
    it('should reuse current payload when refetch() is called', async () => {
      const todosStore = readTodos({ listId });

      await todosStore.run({ query: queryValue });
      runMock.mockClear();

      await todosStore.refetch();

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          scope: { listId },
          payload: { query: queryValue },
        }),
      );
    });

    it('should replace payload when refetch(nextPayload) is called', async () => {
      const todosStore = readTodos({ listId });
      const nextQueryValue = randomString({ prefix: 'next-query' });

      await todosStore.run({ query: queryValue });
      runMock.mockClear();
      await todosStore.refetch({ query: nextQueryValue });

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          scope: { listId },
          payload: { query: nextQueryValue },
        }),
      );
    });

    it('should update payload when refetch receives payload updater callback', async () => {
      const todosStore = readTodos({ listId });
      const nextQueryValue = randomString({ prefix: 'next-query' });

      await todosStore.run({ query: queryValue });
      runMock.mockClear();
      await todosStore.refetch((payload) => ({ ...payload, query: nextQueryValue }));

      expect(runMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          scope: { listId },
          payload: { query: nextQueryValue },
        }),
      );
    });
  });
});
