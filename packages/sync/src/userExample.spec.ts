import { beforeEach, describe, expect, it, vi } from 'vitest';

import { action, type Action } from './action.js';
import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { stream, type Stream } from './stream.js';
import { mockApi } from './testing/mocks/mockApi.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
  listId: string;
}

interface TodoScope {
  listId: string;
}

type TodoEntity = Entity<Todo>;
type TodosApi = ReturnType<typeof mockApi<Todo>>;
type ReadTodoSource = Source<TodoScope, undefined, Todo | null>;
type UpdateTodoAction = Action<TodoScope, Todo, Todo | null>;
type TodoChangedStream = Stream<TodoScope, Todo, Todo | null>;

interface TodoSubscriptionEvent {
  data?: Todo;
  error?: unknown;
}

interface TodoSubscriptionObserver {
  (event: TodoSubscriptionEvent): void;
}

describe('user example flow', () => {
  let todoEntity: TodoEntity;
  let todosApi: TodosApi;
  let findOneSpy = vi.fn();
  let updateSpy = vi.fn();
  let readTodo: ReadTodoSource;
  let updateTodo: UpdateTodoAction;
  let streamRunMock = vi.fn();
  let observeMock = vi.fn();
  let emitSubscriptionEvent: TodoSubscriptionObserver;
  let unsubscribeMock = vi.fn();
  let onTodoChanged: TodoChangedStream;
  let todoId: string;
  let listId: string;
  let baseTitle: string;
  let updatedTitle: string;
  let streamTitle: string;

  beforeEach(async () => {
    todoId = randomString({ prefix: 'todo-id' });
    listId = randomString({ prefix: 'list-id' });
    baseTitle = randomString({ prefix: 'todo-base-title' });
    updatedTitle = randomString({ prefix: 'todo-updated-title' });
    streamTitle = randomString({ prefix: 'todo-stream-title' });

    todosApi = mockApi<Todo>();
    await todosApi.insert({ id: todoId, title: baseTitle, listId });

    findOneSpy = vi.spyOn(todosApi, 'findOne');
    updateSpy = vi.spyOn(todosApi, 'update');

    todoEntity = entity<Todo>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readTodo = source<TodoScope, undefined, Todo | null>({
      entity: todoEntity,
      run: async ({ scope }) => {
        const todo = await todosApi.findOne(scope);
        return todo ?? null;
      },
    });

    updateTodo = action<TodoScope, Todo, Todo | null>({
      entity: todoEntity,
      run: async ({ payload }) => {
        const updated = await todosApi.update({ id: payload.id }, payload);
        return updated ?? null;
      },
    });

    emitSubscriptionEvent = () => undefined;
    unsubscribeMock = vi.fn();
    observeMock = vi.fn((observer: TodoSubscriptionObserver) => {
      emitSubscriptionEvent = observer;
    });

    streamRunMock = vi.fn(async ({ scope }) => {
      const subscription = {
        observe: observeMock,
        unsubscribe: unsubscribeMock,
      };

      subscription.observe((event: TodoSubscriptionEvent) => {
        const { data } = event;

        if (!data) {
          return;
        }

        void readTodo({ listId: scope.listId }).refetch();
      });

      return subscription.unsubscribe;
    });

    onTodoChanged = stream<TodoScope, Todo, Todo | null>({
      entity: todoEntity,
      run: streamRunMock,
    });
  });

  describe('happy', () => {
    it('should call read api once when todo source run is called once', async () => {
      const todoStore = readTodo({ listId });

      await todoStore.run();

      expect(findOneSpy).toHaveBeenCalledTimes(1);
    });

    it('should call read api with list scope when todo source run is called', async () => {
      const todoStore = readTodo({ listId });

      await todoStore.run();

      expect(findOneSpy).toHaveBeenNthCalledWith(1, { listId });
    });

    it('should call update api with edited value when action run is called', async () => {
      const todoStore = readTodo({ listId });
      const updateTodoStore = updateTodo({ listId });

      await todoStore.run();
      await updateTodoStore.run({
        id: todoId,
        title: updatedTitle,
        listId,
      });

      expect(updateSpy).toHaveBeenNthCalledWith(
        1,
        { id: todoId },
        { id: todoId, title: updatedTitle, listId },
      );
    });

    it('should reload todo source when stream emits update for same list', async () => {
      const todoStore = readTodo({ listId });
      const todoChangedStream = onTodoChanged({ listId });

      await todoStore.run();
      todoChangedStream.start();
      emitSubscriptionEvent({
        data: { id: todoId, listId, title: streamTitle },
      });
      await Promise.resolve();

      expect(findOneSpy).toHaveBeenCalledTimes(2);
    });

    it('should call stream run once when stream start is called once', () => {
      const todoChangedStream = onTodoChanged({ listId });

      todoChangedStream.start();

      expect(streamRunMock).toHaveBeenCalledTimes(1);
    });

    it('should call stream unsubscribe when stream stop is called', async () => {
      const todoChangedStream = onTodoChanged({ listId });

      todoChangedStream.start();
      await Promise.resolve();
      todoChangedStream.stop();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });
});
