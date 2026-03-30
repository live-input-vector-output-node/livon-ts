import { describe, expect, it } from 'vitest';

import { action } from './actionLazy.js';
import { draft } from './draftLazy.js';
import { entity } from './entity.js';
import { source } from './sourceLazy.js';
import { stream } from './streamLazy.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoIdentity {
  identity: string;
}

const createCrossUnitDraftSetup = (draftMode: 'local' | 'identity' | 'global') => {
  const todoEntity = entity<Todo>({
    key: `todo-draft-visibility-entity:${draftMode}`,
    idOf: (input) => input.id,
  });

  const readTodo = source({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity>({
    key: `read-draft-visibility:${draftMode}`,
    defaultValue: null,
    run: ({ upsertOne }) => {
      upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });
    },
  });

  const writeTodo = action({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity>({
    key: `write-draft-visibility:${draftMode}`,
    defaultValue: null,
    run: ({ upsertOne }) => {
      upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });
    },
  });

  const watchTodo = stream({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity>({
    key: `watch-draft-visibility:${draftMode}`,
    defaultValue: null,
    run: ({ upsertOne }) => {
      upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });
    },
  });

  const editTodoDraft = draft({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity>({
    key: `edit-draft-visibility:${draftMode}`,
    mode: draftMode,
    defaultValue: null,
    run: ({ upsertOne }) => {
      upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });
    },
  });

  const identityA = {
    identity: 'frontend-a',
  };
  const identityB = {
    identity: 'frontend-b',
  };

  return {
    sourceA: readTodo(identityA),
    sourceB: readTodo(identityB),
    actionA: writeTodo(identityA),
    actionB: writeTodo(identityB),
    streamA: watchTodo(identityA),
    streamB: watchTodo(identityB),
    draftA: editTodoDraft(identityA),
  };
};

describe('draft()', () => {
  describe('happy', () => {
    it('should expose snapshot set/clear with draft status transitions', async () => {
      const todoEntity = entity<Todo>({
        key: 'todo-draft-entity',
        idOf: (input) => input.id,
      });

      const readDraftTodo = draft({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'read-draft-todo',
        defaultValue: null,
        run: ({ set }) => {
          set({
            id: 'todo-1',
            title: 'Persisted',
          });
        },
      });

      const unit = readDraftTodo({
        identity: 'frontend-a',
      });

      todoEntity.upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });

      expect(unit.getSnapshot().status).toBe('clear');
      expect(unit.getSnapshot().value).toBeNull();

      unit.getSnapshot().set({
        id: 'todo-1',
        title: 'Draft',
      });

      expect(unit.getSnapshot().status).toBe('dirty');
      expect(unit.getSnapshot().value?.title).toBe('Draft');

      unit.getSnapshot().clear();

      expect(unit.getSnapshot().status).toBe('clear');
      expect(unit.getSnapshot().value?.title).toBe('Persisted');
    });

    it('should merge partial updates when id is resolvable', async () => {
      const todoEntity = entity<Todo>({
        key: 'todo-draft-partial-entity',
        idOf: (input) => input.id,
      });

      const readDraftTodo = draft({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'read-draft-partial-todo',
        defaultValue: null,
        run: ({ set }) => {
          set({
            id: 'todo-1',
            title: 'Persisted',
          });
        },
      });

      const unit = readDraftTodo({
        identity: 'frontend-a',
      });

      todoEntity.upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });

      unit.getSnapshot().set({
        id: 'todo-1',
        title: 'Patched',
      });

      expect(unit.getSnapshot().status).toBe('dirty');
      expect(unit.getSnapshot().value).toEqual({
        id: 'todo-1',
        title: 'Patched',
      });
    });

    it('should skip overlay creation when id is not resolvable', () => {
      const todoEntity = entity<Todo>({
        key: 'todo-draft-unresolvable-entity',
        idOf: (input) => input.id,
      });

      const readDraftTodo = draft({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'read-draft-unresolvable-todo',
        defaultValue: null,
      });

      const unit = readDraftTodo({
        identity: 'frontend-a',
      });

      unit.getSnapshot().set({
        title: 'No Id',
      });

      expect(unit.getSnapshot().status).toBe('clear');
      expect(unit.getSnapshot().value).toBeNull();
    });

    it('should clear all many-mode overlays for the identity', async () => {
      const todoEntity = entity<Todo>({
        key: 'todo-draft-many-entity',
        idOf: (input) => input.id,
      });

      const readDraftTodos = draft({
        entity: todoEntity,
        mode: 'many',
      })<TodoIdentity>({
        key: 'read-draft-many-todos',
        defaultValue: [],
        run: ({ set }) => {
          set([
            {
              id: 'todo-1',
              title: 'Persisted-1',
            },
            {
              id: 'todo-2',
              title: 'Persisted-2',
            },
          ]);
        },
      });

      const unit = readDraftTodos({
        identity: 'frontend-a',
      });

      todoEntity.upsertMany([
        {
          id: 'todo-1',
          title: 'Persisted-1',
        },
        {
          id: 'todo-2',
          title: 'Persisted-2',
        },
      ]);

      unit.getSnapshot().set([
        {
          id: 'todo-1',
          title: 'Draft-1',
        },
        {
          id: 'todo-2',
          title: 'Draft-2',
        },
      ]);

      expect(unit.getSnapshot().status).toBe('dirty');
      expect(unit.getSnapshot().value).toEqual([
        {
          id: 'todo-1',
          title: 'Draft-1',
        },
        {
          id: 'todo-2',
          title: 'Draft-2',
        },
      ]);

      unit.getSnapshot().clear();

      expect(unit.getSnapshot().status).toBe('clear');
      expect(unit.getSnapshot().value).toEqual([
        {
          id: 'todo-1',
          title: 'Persisted-1',
        },
        {
          id: 'todo-2',
          title: 'Persisted-2',
        },
      ]);
    });

    it('should keep ownership lock and apply queued foreign write after clear', async () => {
      const todoEntity = entity<Todo>({
        key: 'todo-draft-lock-entity',
        idOf: (input) => input.id,
      });

      const readDraftTodo = draft({
        entity: todoEntity,
        mode: 'one',
      })<TodoIdentity>({
        key: 'read-draft-lock-todo',
        defaultValue: null,
        run: ({ set }) => {
          set({
            id: 'todo-1',
            title: 'Persisted',
          });
        },
      });

      const frontendAUnit = readDraftTodo({
        identity: 'frontend-a',
      });
      const frontendBUnit = readDraftTodo({
        identity: 'frontend-b',
      });

      todoEntity.upsertOne({
        id: 'todo-1',
        title: 'Persisted',
      });

      frontendAUnit.getSnapshot().set({
        id: 'todo-1',
        title: 'Draft From A',
      });

      frontendBUnit.getSnapshot().set({
        id: 'todo-1',
        title: 'Incoming From B',
      });

      expect(frontendAUnit.getSnapshot().status).toBe('dirty');
      expect(frontendAUnit.getSnapshot().value?.title).toBe('Draft From A');

      frontendAUnit.getSnapshot().clear();

      expect(frontendAUnit.getSnapshot().status).toBe('clear');
      expect(frontendAUnit.getSnapshot().value?.title).toBe('Incoming From B');
    });

    it('should apply global draft overlay to source action and stream for every identity', async () => {
      const {
        sourceA,
        sourceB,
        actionA,
        actionB,
        streamA,
        streamB,
        draftA,
      } = createCrossUnitDraftSetup('global');

      await Promise.all([
        sourceA.getSnapshot().load(),
        sourceB.getSnapshot().load(),
        actionA.getSnapshot().submit(),
        actionB.getSnapshot().submit(),
        streamA.getSnapshot().start(),
        streamB.getSnapshot().start(),
      ]);

      draftA.getSnapshot().set({
        id: 'todo-1',
        title: 'Draft',
      });

      expect(sourceA.getSnapshot().value?.title).toBe('Draft');
      expect(sourceB.getSnapshot().value?.title).toBe('Draft');
      expect(actionA.getSnapshot().value?.title).toBe('Draft');
      expect(actionB.getSnapshot().value?.title).toBe('Draft');
      expect(streamA.getSnapshot().value?.title).toBe('Draft');
      expect(streamB.getSnapshot().value?.title).toBe('Draft');
    });

    it('should apply identity draft overlay only to matching identity across source action and stream', async () => {
      const {
        sourceA,
        sourceB,
        actionA,
        actionB,
        streamA,
        streamB,
        draftA,
      } = createCrossUnitDraftSetup('identity');

      await Promise.all([
        sourceA.getSnapshot().load(),
        sourceB.getSnapshot().load(),
        actionA.getSnapshot().submit(),
        actionB.getSnapshot().submit(),
        streamA.getSnapshot().start(),
        streamB.getSnapshot().start(),
      ]);

      draftA.getSnapshot().set({
        id: 'todo-1',
        title: 'Draft',
      });

      expect(sourceA.getSnapshot().value?.title).toBe('Draft');
      expect(actionA.getSnapshot().value?.title).toBe('Draft');
      expect(streamA.getSnapshot().value?.title).toBe('Draft');
      expect(sourceB.getSnapshot().value?.title).toBe('Persisted');
      expect(actionB.getSnapshot().value?.title).toBe('Persisted');
      expect(streamB.getSnapshot().value?.title).toBe('Persisted');
    });

    it('should apply local draft overlay only to the draft unit and keep source action stream on persisted value', async () => {
      const {
        sourceA,
        sourceB,
        actionA,
        actionB,
        streamA,
        streamB,
        draftA,
      } = createCrossUnitDraftSetup('local');

      await Promise.all([
        sourceA.getSnapshot().load(),
        sourceB.getSnapshot().load(),
        actionA.getSnapshot().submit(),
        actionB.getSnapshot().submit(),
        streamA.getSnapshot().start(),
        streamB.getSnapshot().start(),
      ]);

      draftA.getSnapshot().set({
        id: 'todo-1',
        title: 'Draft',
      });

      expect(draftA.getSnapshot().value?.title).toBe('Draft');
      expect(sourceA.getSnapshot().value?.title).toBe('Persisted');
      expect(actionA.getSnapshot().value?.title).toBe('Persisted');
      expect(streamA.getSnapshot().value?.title).toBe('Persisted');
      expect(sourceB.getSnapshot().value?.title).toBe('Persisted');
      expect(actionB.getSnapshot().value?.title).toBe('Persisted');
      expect(streamB.getSnapshot().value?.title).toBe('Persisted');
    });
  });
});
