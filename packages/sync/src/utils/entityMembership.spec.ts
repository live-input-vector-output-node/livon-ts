import { describe, expect, it } from 'vitest';

import { entity } from '../entity.js';
import {
  setManyEntityMembership,
  setOneEntityMembership,
  type EntityMembershipState,
} from './entityMembership.js';

interface Todo {
  id: string;
  title: string;
}

describe('entity membership helpers', () => {
  const todosEntity = entity<Todo>({
    idOf: (value) => value.id,
  });

  it('should keep one-mode membership reference stable when id is unchanged', () => {
    const state: EntityMembershipState<string> = {
      key: 'todo-unit-one',
      mode: 'one',
      hasEntityValue: false,
      membershipIds: [],
    };
    const firstValue: Todo = {
      id: 'todo-1',
      title: 'Todo One',
    };

    setOneEntityMembership(state, {
      entity: todosEntity,
      value: firstValue,
    });
    const firstMembershipIds = state.membershipIds;

    setOneEntityMembership(state, {
      entity: todosEntity,
      value: {
        id: 'todo-1',
        title: 'Todo One Updated',
      },
    });

    expect(state.membershipIds).toBe(firstMembershipIds);
  });

  it('should keep many-mode membership reference stable when ids and order are unchanged', () => {
    const state: EntityMembershipState<string> = {
      key: 'todo-unit-many',
      mode: 'many',
      hasEntityValue: false,
      membershipIds: [],
    };
    const firstValues: readonly Todo[] = [
      {
        id: 'todo-1',
        title: 'Todo One',
      },
      {
        id: 'todo-2',
        title: 'Todo Two',
      },
    ];

    setManyEntityMembership(state, {
      entity: todosEntity,
      values: firstValues,
    });
    const firstMembershipIds = state.membershipIds;

    setManyEntityMembership(state, {
      entity: todosEntity,
      values: [
        {
          id: 'todo-1',
          title: 'Todo One Updated',
        },
        {
          id: 'todo-2',
          title: 'Todo Two Updated',
        },
      ],
    });

    expect(state.membershipIds).toBe(firstMembershipIds);
  });

  it('should replace many-mode membership reference when order changes', () => {
    const state: EntityMembershipState<string> = {
      key: 'todo-unit-many-order',
      mode: 'many',
      hasEntityValue: false,
      membershipIds: [],
    };

    setManyEntityMembership(state, {
      entity: todosEntity,
      values: [
        {
          id: 'todo-1',
          title: 'Todo One',
        },
        {
          id: 'todo-2',
          title: 'Todo Two',
        },
      ],
    });
    const firstMembershipIds = state.membershipIds;

    setManyEntityMembership(state, {
      entity: todosEntity,
      values: [
        {
          id: 'todo-2',
          title: 'Todo Two',
        },
        {
          id: 'todo-1',
          title: 'Todo One',
        },
      ],
    });

    expect(state.membershipIds).not.toBe(firstMembershipIds);
    expect(state.membershipIds).toEqual(['todo-2', 'todo-1']);
  });
});
