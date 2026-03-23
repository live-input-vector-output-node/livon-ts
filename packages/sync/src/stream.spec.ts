import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { stream, type Stream } from './stream.js';
import { randomNumber, randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoScope {
  listId: number;
}

type TodosEntity = Entity<Todo>;
type TodoChangedStream = Stream<TodoScope, Todo, Todo | null, Todo>;

describe('stream()', () => {
  let todosEntity: TodosEntity;
  let streamRunMock = vi.fn();
  let unsubscribeMock = vi.fn();
  let onTodoChanged: TodoChangedStream;
  let listId: number;
  let eventTodoId: string;
  let eventTodoTitle: string;

  beforeEach(() => {
    listId = randomNumber();
    eventTodoId = randomString({ prefix: 'event-todo-id' });
    eventTodoTitle = randomString({ prefix: 'event-todo-title' });

    todosEntity = entity<Todo>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    unsubscribeMock = vi.fn();
    streamRunMock = vi.fn(async () => {
      return () => {
        unsubscribeMock();
      };
    });

    onTodoChanged = stream<TodoScope, Todo, Todo, Todo | null, Todo>({
      entity: todosEntity,
      run: streamRunMock,
    });
  });

  describe('happy', () => {
    it('should expose start function when stream unit is created', () => {
      const streamStore = onTodoChanged({ listId });

      expect(typeof streamStore.start).toBe('function');
    });

    it('should expose stop function when stream unit is created', () => {
      const streamStore = onTodoChanged({ listId });

      expect(typeof streamStore.stop).toBe('function');
    });

    it('should call run once when start is invoked once', () => {
      const streamStore = onTodoChanged({ listId });
      const payload = {
        id: eventTodoId,
        title: eventTodoTitle,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenCalledTimes(1);
    });

    it('should call cleanup once when stop is invoked after start', async () => {
      const streamStore = onTodoChanged({ listId });
      const payload = {
        id: eventTodoId,
        title: eventTodoTitle,
      };

      streamStore.start(payload);
      await Promise.resolve();
      streamStore.stop();
      await Promise.resolve();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });

    it('should pass scope to run handler when stream starts', () => {
      const streamStore = onTodoChanged({ listId });
      const payload = {
        id: eventTodoId,
        title: eventTodoTitle,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ scope: { listId } }),
      );
    });

    it('should pass payload to run handler when stream starts', () => {
      const streamStore = onTodoChanged({ listId });
      const payload = {
        id: eventTodoId,
        title: eventTodoTitle,
      };

      streamStore.start(payload);

      expect(streamRunMock).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ payload: { id: eventTodoId, title: eventTodoTitle } }),
      );
    });

    it('should not expose refetch in run context', async () => {
      streamRunMock = vi.fn(async (context) => {
        const hasRefetch = Object.prototype.hasOwnProperty.call(context, 'refetch');
        const hasEntity = Object.prototype.hasOwnProperty.call(context, 'entity');

        expect(hasRefetch).toBe(false);
        expect(hasEntity).toBe(false);
      });

      onTodoChanged = stream<TodoScope, Todo, Todo, Todo | null, Todo>({
        entity: todosEntity,
        run: streamRunMock,
      });

      const streamStore = onTodoChanged({ listId });
      const payload = {
        id: eventTodoId,
        title: eventTodoTitle,
      };

      streamStore.start(payload);
      await Promise.resolve();
    });
  });
});
