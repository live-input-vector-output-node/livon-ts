import { describe, expect, it } from 'vitest';

import { entity } from './entity.js';
import { source } from './source.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoScope {
  listId: string;
}

describe('source() DX', () => {
  describe('sad', () => {
    it('should not expose direct set APIs on source units', () => {
      const listId = randomString({ prefix: 'list-id' });
      const todoId = randomString({ prefix: 'todo-id' });
      const todoTitle = randomString({ prefix: 'todo-title' });

      const todosEntity = entity<Todo>({
        idOf: (value) => value.id,
      });

      const readTodos = source<TodoScope, undefined, Todo, readonly Todo[]>({
        entity: todosEntity,
        run: async () => {
          return [
            {
              id: todoId,
              title: todoTitle,
              completed: false,
            },
          ];
        },
      });

      const readTodosUnit = readTodos({ listId });
      const readTodosUnitApi = readTodosUnit as unknown as Record<string, unknown>;
      const draftApi = readTodosUnitApi.draft as Record<string, unknown> | undefined;

      expect(readTodosUnitApi.set).toBeUndefined();
      expect(readTodosUnitApi.setDraft).toBeUndefined();
      expect(readTodosUnitApi.cleanDraft).toBeUndefined();
      expect(typeof draftApi?.set).toBe('function');
      expect(typeof draftApi?.clean).toBe('function');
    });
  });
});
