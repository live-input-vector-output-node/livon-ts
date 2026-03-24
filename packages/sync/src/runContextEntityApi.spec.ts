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

interface ContextShape {
  hasTopLevelUpsertOne: boolean;
  hasTopLevelUpsertMany: boolean;
  hasTopLevelRemoveOne: boolean;
  hasTopLevelRemoveMany: boolean;
  hasEntityUpsertOne: boolean;
  hasEntityUpsertMany: boolean;
  hasEntityRemoveOne: boolean;
  hasEntityRemoveMany: boolean;
}

interface ContextReferenceShape {
  context: unknown;
  scope: unknown;
  payload: unknown;
  setMeta: unknown;
  upsertOne: unknown;
  upsertMany: unknown;
  removeOne: unknown;
  removeMany: unknown;
}

describe('run context entity api', () => {
  describe('happy', () => {
    it('should keep source run-context instance and top-level mutation methods stable for same scope and payload', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const capturedContexts: ContextReferenceShape[] = [];
      const payloadA = {
        id: randomString({ prefix: 'payload-a-id' }),
        title: randomString({ prefix: 'payload-a-title' }),
      };
      const payloadB = {
        id: randomString({ prefix: 'payload-b-id' }),
        title: randomString({ prefix: 'payload-b-title' }),
      };

      const readTodo = source<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          capturedContexts.push({
            context,
            scope: context.scope,
            payload: context.payload,
            setMeta: context.setMeta,
            upsertOne: context.upsertOne,
            upsertMany: context.upsertMany,
            removeOne: context.removeOne,
            removeMany: context.removeMany,
          });

          return context.payload;
        },
      });

      const scope = { listId: randomString({ prefix: 'list-id' }) };
      const unit = readTodo(scope);

      await unit.run(payloadA);
      await unit.run(payloadA);
      await unit.run(payloadB);
      await unit.run(payloadA);

      const first = capturedContexts[0];
      const second = capturedContexts[1];
      const third = capturedContexts[2];
      const fourth = capturedContexts[3];
      if (!first || !second || !third || !fourth) {
        throw new Error('source run-context captures are missing');
      }

      expect(first.context).toBe(second.context);
      expect(first.scope).toBe(second.scope);
      expect(first.payload).toBe(second.payload);
      expect(first.setMeta).toBe(second.setMeta);
      expect(first.upsertOne).toBe(second.upsertOne);
      expect(first.upsertMany).toBe(second.upsertMany);
      expect(first.removeOne).toBe(second.removeOne);
      expect(first.removeMany).toBe(second.removeMany);

      expect(first.context).not.toBe(third.context);
      expect(first.scope).toBe(third.scope);
      expect(first.payload).not.toBe(third.payload);
      expect(first.setMeta).not.toBe(third.setMeta);
      expect(first.upsertOne).not.toBe(third.upsertOne);
      expect(first.upsertMany).not.toBe(third.upsertMany);
      expect(first.removeOne).not.toBe(third.removeOne);
      expect(first.removeMany).not.toBe(third.removeMany);

      expect(first.context).toBe(fourth.context);
      expect(first.scope).toBe(fourth.scope);
      expect(first.payload).toBe(fourth.payload);
      expect(first.setMeta).toBe(fourth.setMeta);
      expect(first.upsertOne).toBe(fourth.upsertOne);
      expect(first.upsertMany).toBe(fourth.upsertMany);
      expect(first.removeOne).toBe(fourth.removeOne);
      expect(first.removeMany).toBe(fourth.removeMany);
    });

    it('should keep action run-context instance and top-level mutation methods stable for same scope and payload', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const capturedContexts: ContextReferenceShape[] = [];
      const payloadA = {
        id: randomString({ prefix: 'payload-a-id' }),
        title: randomString({ prefix: 'payload-a-title' }),
      };
      const payloadB = {
        id: randomString({ prefix: 'payload-b-id' }),
        title: randomString({ prefix: 'payload-b-title' }),
      };

      const updateTodo = action<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          capturedContexts.push({
            context,
            scope: context.scope,
            payload: context.payload,
            setMeta: context.setMeta,
            upsertOne: context.upsertOne,
            upsertMany: context.upsertMany,
            removeOne: context.removeOne,
            removeMany: context.removeMany,
          });

          return context.payload;
        },
      });

      const scope = { listId: randomString({ prefix: 'list-id' }) };
      const unit = updateTodo(scope);

      await unit.run(payloadA);
      await unit.run(payloadA);
      await unit.run(payloadB);
      await unit.run(payloadA);

      const first = capturedContexts[0];
      const second = capturedContexts[1];
      const third = capturedContexts[2];
      const fourth = capturedContexts[3];
      if (!first || !second || !third || !fourth) {
        throw new Error('action run-context captures are missing');
      }

      expect(first.context).toBe(second.context);
      expect(first.scope).toBe(second.scope);
      expect(first.payload).toBe(second.payload);
      expect(first.setMeta).toBe(second.setMeta);
      expect(first.upsertOne).toBe(second.upsertOne);
      expect(first.upsertMany).toBe(second.upsertMany);
      expect(first.removeOne).toBe(second.removeOne);
      expect(first.removeMany).toBe(second.removeMany);

      expect(first.context).not.toBe(third.context);
      expect(first.scope).toBe(third.scope);
      expect(first.payload).not.toBe(third.payload);
      expect(first.setMeta).not.toBe(third.setMeta);
      expect(first.upsertOne).not.toBe(third.upsertOne);
      expect(first.upsertMany).not.toBe(third.upsertMany);
      expect(first.removeOne).not.toBe(third.removeOne);
      expect(first.removeMany).not.toBe(third.removeMany);

      expect(first.context).toBe(fourth.context);
      expect(first.scope).toBe(fourth.scope);
      expect(first.payload).toBe(fourth.payload);
      expect(first.setMeta).toBe(fourth.setMeta);
      expect(first.upsertOne).toBe(fourth.upsertOne);
      expect(first.upsertMany).toBe(fourth.upsertMany);
      expect(first.removeOne).toBe(fourth.removeOne);
      expect(first.removeMany).toBe(fourth.removeMany);
    });

    it('should keep stream run-context instance and top-level mutation methods stable for same scope and payload', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      const capturedContexts: ContextReferenceShape[] = [];
      const payloadA = {
        id: randomString({ prefix: 'payload-a-id' }),
        title: randomString({ prefix: 'payload-a-title' }),
      };
      const payloadB = {
        id: randomString({ prefix: 'payload-b-id' }),
        title: randomString({ prefix: 'payload-b-title' }),
      };

      const todoChanged = stream<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          capturedContexts.push({
            context,
            scope: context.scope,
            payload: context.payload,
            setMeta: context.setMeta,
            upsertOne: context.upsertOne,
            upsertMany: context.upsertMany,
            removeOne: context.removeOne,
            removeMany: context.removeMany,
          });
        },
      });

      const scope = { listId: randomString({ prefix: 'list-id' }) };
      const unit = todoChanged(scope);

      unit.start(payloadA);
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      unit.start(payloadA);
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      unit.start(payloadB);
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      unit.start(payloadA);
      await Promise.resolve();
      await Promise.resolve();
      unit.stop();

      const first = capturedContexts[0];
      const second = capturedContexts[1];
      const third = capturedContexts[2];
      const fourth = capturedContexts[3];
      if (!first || !second || !third || !fourth) {
        throw new Error('stream run-context captures are missing');
      }

      expect(first.context).toBe(second.context);
      expect(first.scope).toBe(second.scope);
      expect(first.payload).toBe(second.payload);
      expect(first.setMeta).toBe(second.setMeta);
      expect(first.upsertOne).toBe(second.upsertOne);
      expect(first.upsertMany).toBe(second.upsertMany);
      expect(first.removeOne).toBe(second.removeOne);
      expect(first.removeMany).toBe(second.removeMany);

      expect(first.context).not.toBe(third.context);
      expect(first.scope).toBe(third.scope);
      expect(first.payload).not.toBe(third.payload);
      expect(first.setMeta).not.toBe(third.setMeta);
      expect(first.upsertOne).not.toBe(third.upsertOne);
      expect(first.upsertMany).not.toBe(third.upsertMany);
      expect(first.removeOne).not.toBe(third.removeOne);
      expect(first.removeMany).not.toBe(third.removeMany);

      expect(first.context).toBe(fourth.context);
      expect(first.scope).toBe(fourth.scope);
      expect(first.payload).toBe(fourth.payload);
      expect(first.setMeta).toBe(fourth.setMeta);
      expect(first.upsertOne).toBe(fourth.upsertOne);
      expect(first.upsertMany).toBe(fourth.upsertMany);
      expect(first.removeOne).toBe(fourth.removeOne);
      expect(first.removeMany).toBe(fourth.removeMany);
    });
  });

  describe('sad', () => {
    it('should expose only top-level split mutation api in source run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const readTodo = source<TodoScope, undefined, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      await readTodo({ listId: randomString({ prefix: 'list-id' }) }).run();

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: true,
        hasTopLevelUpsertMany: true,
        hasTopLevelRemoveOne: true,
        hasTopLevelRemoveMany: true,
        hasEntityUpsertOne: false,
        hasEntityUpsertMany: false,
        hasEntityRemoveOne: false,
        hasEntityRemoveMany: false,
      });
    });

    it('should expose only top-level split mutation api in action run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const updateTodo = action<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      await updateTodo({ listId: randomString({ prefix: 'list-id' }) }).run({
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      });

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: true,
        hasTopLevelUpsertMany: true,
        hasTopLevelRemoveOne: true,
        hasTopLevelRemoveMany: true,
        hasEntityUpsertOne: false,
        hasEntityUpsertMany: false,
        hasEntityRemoveOne: false,
        hasEntityRemoveMany: false,
      });
    });

    it('should expose only top-level split mutation api in stream run context', async () => {
      const todosEntity = entity<Todo>({
        idOf: (todo) => todo.id,
      });
      let contextShape: ContextShape | null = null;

      const todoChanged = stream<TodoScope, Todo, Todo, Todo | null>({
        entity: todosEntity,
        run: async (context) => {
          const rawContext = context as unknown as Record<string, unknown>;
          const entityApi = rawContext.entity as Record<string, unknown> | undefined;

          contextShape = {
            hasTopLevelUpsertOne: typeof rawContext.upsertOne === 'function',
            hasTopLevelUpsertMany: typeof rawContext.upsertMany === 'function',
            hasTopLevelRemoveOne: typeof rawContext.removeOne === 'function',
            hasTopLevelRemoveMany: typeof rawContext.removeMany === 'function',
            hasEntityUpsertOne: typeof entityApi?.upsertOne === 'function',
            hasEntityUpsertMany: typeof entityApi?.upsertMany === 'function',
            hasEntityRemoveOne: typeof entityApi?.removeOne === 'function',
            hasEntityRemoveMany: typeof entityApi?.removeMany === 'function',
          };
        },
      });

      const unit = todoChanged({ listId: randomString({ prefix: 'list-id' }) });

      unit.start({
        id: randomString({ prefix: 'todo-id' }),
        title: randomString({ prefix: 'todo-title' }),
      });
      await Promise.resolve();
      await Promise.resolve();

      expect(contextShape).toEqual({
        hasTopLevelUpsertOne: true,
        hasTopLevelUpsertMany: true,
        hasTopLevelRemoveOne: true,
        hasTopLevelRemoveMany: true,
        hasEntityUpsertOne: false,
        hasEntityUpsertMany: false,
        hasEntityRemoveOne: false,
        hasEntityRemoveMany: false,
      });
    });
  });
});
