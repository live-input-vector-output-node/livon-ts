import { describe, expect, it } from 'vitest';

import { action } from './action.js';
import { entity } from './entity.js';
import { source } from './source.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoIdentity {
  listId: string;
}

describe('lazy entry points', () => {
  describe('happy', () => {
    it('should run source from the public lazy entrypoint', async () => {
      const todoEntity = entity<Todo>({
        key: 'lazy-entry-source-entity',
        idOf: ({ id }) => id,
      });

      const readTodo = source({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'lazy-entry-source',
        defaultValue: null,
        run: ({ upsertOne }) => {
          upsertOne({
            id: 'todo-1',
            title: 'From source lazy',
          });
        },
      });

      const unit = readTodo({
        listId: 'list-1',
      });

      expect(unit.getSnapshot().value).toBeNull();

      await unit.getSnapshot().load();

      expect(unit.getSnapshot().status).toBe('success');
      expect(todoEntity.getById('todo-1')).toEqual({
        id: 'todo-1',
        title: 'From source lazy',
      });
    });

    it('should run action from the public lazy entrypoint', async () => {
      const todoEntity = entity<Todo>({
        key: 'lazy-entry-action-entity',
        idOf: ({ id }) => id,
      });

      const updateTodo = action({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'lazy-entry-action',
        defaultValue: null,
        run: ({ upsertOne }) => {
          upsertOne({
            id: 'todo-2',
            title: 'From action lazy',
          });
        },
      });

      const unit = updateTodo({
        listId: 'list-2',
      });

      expect(unit.getSnapshot().value).toBeNull();

      await unit.getSnapshot().submit();

      expect(unit.getSnapshot().value).toEqual({
        id: 'todo-2',
        title: 'From action lazy',
      });
    });
  });
});
