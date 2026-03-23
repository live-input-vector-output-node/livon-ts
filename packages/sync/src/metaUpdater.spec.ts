import { describe, expect, it } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';
import { stream } from './stream.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoScope {
  listId: string;
}

interface SourcePayload {
  mode: 'seed' | 'reuse';
  todo: Todo;
}

interface ActionPayload {
  mode: 'seed' | 'reuse';
  todo: Todo;
}

interface StreamPayload {
  mode: 'seed' | 'reuse';
  todo: Todo;
}

interface MessageMeta {
  severity: 'warning';
  text: string;
}

describe('meta updater semantics', () => {
  describe('sad', () => {
    it('should keep source meta instance when setMeta updater returns previous meta', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const warningMeta: MessageMeta = {
        severity: 'warning',
        text: randomString({ prefix: 'meta-text' }),
      };
      let latestMeta: unknown = null;

      const readTodo = source<TodoScope, SourcePayload, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ payload, setMeta }) => {
          if (payload.mode === 'seed') {
            setMeta(warningMeta);
          } else {
            setMeta((oldMeta: unknown) => oldMeta);
          }

          return payload.todo;
        },
      });

      const unit = readTodo({ listId: randomString({ prefix: 'list-id' }) });
      unit.effect((snapshot) => {
        latestMeta = snapshot.meta;
      });

      await unit.run({
        mode: 'seed',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });

      expect(latestMeta).toBe(warningMeta);

      await unit.run({
        mode: 'reuse',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });

      expect(latestMeta).toBe(warningMeta);
    });

    it('should keep action meta instance when setMeta updater returns previous meta', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const warningMeta: MessageMeta = {
        severity: 'warning',
        text: randomString({ prefix: 'meta-text' }),
      };
      let latestMeta: unknown = null;

      const updateTodo = action<TodoScope, ActionPayload, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ payload, setMeta }) => {
          if (payload.mode === 'seed') {
            setMeta(warningMeta);
          } else {
            setMeta((oldMeta: unknown) => oldMeta);
          }

          return payload.todo;
        },
      });

      const unit = updateTodo({ listId: randomString({ prefix: 'list-id' }) });
      unit.effect((snapshot) => {
        latestMeta = snapshot.meta;
      });

      await unit.run({
        mode: 'seed',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });

      expect(latestMeta).toBe(warningMeta);

      await unit.run({
        mode: 'reuse',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });

      expect(latestMeta).toBe(warningMeta);
    });

    it('should keep stream meta instance when setMeta updater returns previous meta', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const warningMeta: MessageMeta = {
        severity: 'warning',
        text: randomString({ prefix: 'meta-text' }),
      };
      let latestMeta: unknown = null;

      const todoChanged = stream<TodoScope, StreamPayload, Todo, Todo | null>({
        entity: todosEntity,
        run: async ({ payload, setMeta }) => {
          if (payload.mode === 'seed') {
            setMeta(warningMeta);
          } else {
            setMeta((oldMeta: unknown) => oldMeta);
          }

          return payload.todo;
        },
      });

      const unit = todoChanged({ listId: randomString({ prefix: 'list-id' }) });
      unit.effect((snapshot) => {
        latestMeta = snapshot.meta;
      });

      unit.start({
        mode: 'seed',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      expect(latestMeta).toBe(warningMeta);

      unit.start({
        mode: 'reuse',
        todo: {
          id: randomString({ prefix: 'todo-id' }),
          title: randomString({ prefix: 'todo-title' }),
        },
      });
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      expect(latestMeta).toBe(warningMeta);
    });
  });
});
