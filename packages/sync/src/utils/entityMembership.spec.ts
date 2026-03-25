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
      modeLocked: false,
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
      modeLocked: false,
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
      modeLocked: false,
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

  it('should lock mode with first entity write even when initial default mode differs', () => {
    const state: EntityMembershipState<string> = {
      key: 'todo-unit-first-write-lock',
      mode: 'many',
      modeLocked: false,
      hasEntityValue: false,
      membershipIds: [],
    };

    setOneEntityMembership(state, {
      entity: todosEntity,
      value: {
        id: 'todo-1',
        title: 'Todo One',
      },
      operation: 'runContext.upsertOne()',
    });

    expect(state.mode).toBe('one');
    expect(state.modeLocked).toBe(true);
  });

  it('should throw semantic error when a locked mode is switched', () => {
    const state: EntityMembershipState<string> = {
      key: 'todo-unit-locked-mode',
      mode: 'one',
      modeLocked: true,
      hasEntityValue: true,
      membershipIds: ['todo-1'],
    };

    expect(() => {
      setManyEntityMembership(state, {
        entity: todosEntity,
        values: [
          {
            id: 'todo-1',
            title: 'Todo One',
          },
        ],
        operation: 'runContext.upsertMany()',
      });
    }).toThrow("Entity mode is locked for scope unit 'todo-unit-locked-mode' as 'one'. Cannot switch to 'many' via runContext.upsertMany().");
  });
});
