import { describe, expect, it } from 'vitest';

import { getModeValue, type ModeValueState } from './entityMode.js';

interface Todo {
  id: string;
  title: string;
}

type TodoManyInternal = ModeValueState<string, readonly Todo[]> & {
  mode: 'many';
  hasEntityValue: true;
};

interface CreateTodoManyInternalInput {
  membershipIds: readonly string[];
  subview?: boolean;
}

const createTodoManyInternal = ({
  membershipIds,
  subview,
}: CreateTodoManyInternalInput): TodoManyInternal => {
  return {
    mode: 'many',
    hasEntityValue: true,
    membershipIds,
    readWrite: subview === undefined ? undefined : {
      subview,
    },
    state: {
      value: [],
    },
  };
};

describe('getModeValue()', () => {
  describe('happy', () => {
    it('should keep many-value reference stable for large memberships when entities are unchanged', () => {
      const membershipIds = Array.from({ length: 40 }, (_unused, index) => {
        return `todo-${index}`;
      });
      const todosById = new Map<string, Todo>(
        membershipIds.map((id) => {
          return [id, { id, title: `Todo ${id}` }];
        }),
      );
      const internal = createTodoManyInternal({
        membershipIds,
      });

      const first = getModeValue(internal, (id) => {
        return todosById.get(id);
      });
      internal.state.value = first;
      const second = getModeValue(internal, (id) => {
        return todosById.get(id);
      });

      expect(second).toBe(first);
    });

    it('should rebuild many-value when large membership entries changed', () => {
      const membershipIds = Array.from({ length: 40 }, (_unused, index) => {
        return `todo-${index}`;
      });
      const todosById = new Map<string, Todo>(
        membershipIds.map((id) => {
          return [id, { id, title: `Todo ${id}` }];
        }),
      );
      const changedTodo = {
        id: membershipIds[5] ?? 'todo-5',
        title: 'Changed todo',
      };
      const internal = createTodoManyInternal({
        membershipIds,
      });

      const first = getModeValue(internal, (id) => {
        return todosById.get(id);
      });
      internal.state.value = first;
      todosById.set(changedTodo.id, changedTodo);
      const second = getModeValue(internal, (id) => {
        return todosById.get(id);
      });

      expect(second).not.toBe(first);
      expect(second[5]).toBe(changedTodo);
    });

    it('should keep direct map path for small memberships and return a fresh array', () => {
      const membershipIds = ['todo-1', 'todo-2'];
      const todosById = new Map<string, Todo>([
        ['todo-1', { id: 'todo-1', title: 'Todo 1' }],
        ['todo-2', { id: 'todo-2', title: 'Todo 2' }],
      ]);
      const internal = createTodoManyInternal({
        membershipIds,
      });

      const first = getModeValue(internal, (id) => {
        return todosById.get(id);
      });
      internal.state.value = first;
      const second = getModeValue(internal, (id) => {
        return todosById.get(id);
      });

      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    });

    it('should return a fresh many-value when subview strategy is disabled', () => {
      const membershipIds = Array.from({ length: 40 }, (_unused, index) => {
        return `todo-${index}`;
      });
      const todosById = new Map<string, Todo>(
        membershipIds.map((id) => {
          return [id, { id, title: `Todo ${id}` }];
        }),
      );
      const internal = createTodoManyInternal({
        membershipIds,
        subview: false,
      });

      const first = getModeValue(internal, (id) => {
        return todosById.get(id);
      });
      internal.state.value = first;
      const second = getModeValue(internal, (id) => {
        return todosById.get(id);
      });

      expect(second).not.toBe(first);
      expect(second).toEqual(first);
    });
  });
});
