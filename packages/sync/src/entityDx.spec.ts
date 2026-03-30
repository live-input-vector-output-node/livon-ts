import { describe, expect, it } from 'vitest';

import { entity, type UpsertOptions } from './entity.js';
import { randomString } from './testing/randomData.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface EntityDxApi {
  upsertOne: (input: Todo, options?: UpsertOptions) => Todo;
  upsertMany: (input: readonly Todo[], options?: UpsertOptions) => readonly Todo[];
  deleteOne: (id: string) => boolean;
  deleteMany: (ids: readonly string[]) => readonly string[];
}

describe('entity() DX', () => {
  describe('happy', () => {
    it('should expose split one/many mutation methods', () => {
      const todosEntity = entity<Todo>({
        key: 'entity-dx-spec',
        idOf: (value) => value.id,
      });
      const todoEntityApi = todosEntity as unknown as Record<string, unknown>;

      expect(typeof todoEntityApi.upsertOne).toBe('function');
      expect(typeof todoEntityApi.upsertMany).toBe('function');
      expect(typeof todoEntityApi.deleteOne).toBe('function');
      expect(typeof todoEntityApi.deleteMany).toBe('function');
    });

    it('should upsert one and many with explicit methods', () => {
      const firstTodoId = randomString({ prefix: 'todo-id' });
      const secondTodoId = randomString({ prefix: 'todo-id' });
      const firstTodoTitle = randomString({ prefix: 'todo-title' });
      const secondTodoTitle = randomString({ prefix: 'todo-title' });

      const firstTodo: Todo = {
        id: firstTodoId,
        title: firstTodoTitle,
        completed: false,
      };
      const secondTodo: Todo = {
        id: secondTodoId,
        title: secondTodoTitle,
        completed: false,
      };

      const todosEntity = entity<Todo>({
        key: 'entity-dx-spec',
        idOf: (value) => value.id,
      });
      const todoEntityApi = todosEntity as unknown as EntityDxApi;

      const upsertOneResult = todoEntityApi.upsertOne(firstTodo);
      const upsertManyResult = todoEntityApi.upsertMany([firstTodo, secondTodo]);

      expect(upsertOneResult).toEqual(firstTodo);
      expect(upsertManyResult).toEqual([firstTodo, secondTodo]);
      expect(todosEntity.getById(firstTodoId)).toEqual(firstTodo);
      expect(todosEntity.getById(secondTodoId)).toEqual(secondTodo);
    });

    it('should remove one and many with explicit methods', () => {
      const firstTodoId = randomString({ prefix: 'todo-id' });
      const secondTodoId = randomString({ prefix: 'todo-id' });
      const firstTodoTitle = randomString({ prefix: 'todo-title' });
      const secondTodoTitle = randomString({ prefix: 'todo-title' });

      const firstTodo: Todo = {
        id: firstTodoId,
        title: firstTodoTitle,
        completed: false,
      };
      const secondTodo: Todo = {
        id: secondTodoId,
        title: secondTodoTitle,
        completed: false,
      };

      const todosEntity = entity<Todo>({
        key: 'entity-dx-spec',
        idOf: (value) => value.id,
      });
      const todoEntityApi = todosEntity as unknown as EntityDxApi;

      todoEntityApi.upsertMany([firstTodo, secondTodo]);
      const removeOneResult = todoEntityApi.deleteOne(firstTodoId);
      const removeManyResult = todoEntityApi.deleteMany([secondTodoId]);

      expect(removeOneResult).toBe(true);
      expect(removeManyResult).toEqual([secondTodoId]);
      expect(todosEntity.getById(firstTodoId)).toBeUndefined();
      expect(todosEntity.getById(secondTodoId)).toBeUndefined();
    });
  });

  describe('sad', () => {
    it('should not expose unified mutation methods', () => {
      const todosEntity = entity<Todo>({
        key: 'entity-dx-spec',
        idOf: (value) => value.id,
      });
      const todoEntityApi = todosEntity as unknown as Record<string, unknown>;

      expect(todoEntityApi.upsert).toBeUndefined();
      expect(todoEntityApi.remove).toBeUndefined();
    });
  });
});
