import {
  action,
  draft,
  entity,
  source,
  stream,
  type UnitStatus,
} from '@livon/sync';
import { describe, expectTypeOf, it } from 'vitest';

import { useLivonMeta } from './useLivonMeta.js';
import { useLivonState } from './useLivonState.js';
import { useLivonStatus } from './useLivonStatus.js';
import { useLivonValue } from './useLivonValue.js';

interface Todo {
  id: string;
  title: string;
}

interface TodoIdentity {
  listId: string;
}

interface TodoMeta {
  severity: 'info' | 'error';
  text: string;
}

const createTodoEntity = () => {
  return entity<Todo>({
    key: 'react-use-livon-types-todo-entity',
    idOf: (value) => value.id,
  });
};

const createReadTodosSource = (todoEntity: ReturnType<typeof createTodoEntity>) => {
  return source({
    entity: todoEntity,
    mode: 'many',
  })<TodoIdentity, undefined>({
    key: 'react-use-livon-types-read-todos-source',
    defaultValue: [],
    run: ({ set }) => {
      set([]);
    },
  });
};

const createUpdateTodoAction = (todoEntity: ReturnType<typeof createTodoEntity>) => {
  return action({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity, Todo>({
    key: 'react-use-livon-types-update-todo-action',
    defaultValue: null,
    run: ({ payload, upsertOne }) => {
      upsertOne(payload);
    },
  });
};

const createTodoStream = (todoEntity: ReturnType<typeof createTodoEntity>) => {
  return stream({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity, Todo>({
    key: 'react-use-livon-types-todo-stream',
    defaultValue: null,
    run: ({ payload, upsertOne }) => {
      upsertOne(payload);
    },
  });
};

const createReadTodoDraft = (todoEntity: ReturnType<typeof createTodoEntity>) => {
  return draft({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity>({
    key: 'react-use-livon-types-read-todo-draft',
    defaultValue: null,
    run: ({ set }) => {
      set({
        id: 'todo-draft-1',
        title: 'draft',
      });
    },
  });
};

const createTypedMetaUnits = () => {
  const todoEntity = createTodoEntity();

  const readTodos = source({
    entity: todoEntity,
    mode: 'many',
  })<TodoIdentity, undefined, TodoMeta>({
    key: 'react-use-livon-types-meta-read-todos-source',
    defaultValue: [],
    run: ({ set, setMeta }) => {
      setMeta({
        severity: 'info',
        text: 'source-meta',
      });
      set([]);
    },
  });

  const updateTodo = action({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity, Todo, TodoMeta>({
    key: 'react-use-livon-types-meta-update-todo-action',
    defaultValue: null,
    run: ({ payload, setMeta, upsertOne }) => {
      setMeta({
        severity: 'info',
        text: 'action-meta',
      });
      upsertOne(payload);
    },
  });

  const onTodoUpdated = stream({
    entity: todoEntity,
    mode: 'one',
  })<TodoIdentity, Todo, TodoMeta>({
    key: 'react-use-livon-types-meta-on-todo-updated-stream',
    defaultValue: null,
    run: ({ payload, setMeta, upsertOne }) => {
      setMeta({
        severity: 'info',
        text: 'stream-meta',
      });
      upsertOne(payload);
    },
  });

  return {
    sourceUnit: readTodos({ listId: 'typed-meta-source' }),
    actionUnit: updateTodo({ listId: 'typed-meta-action' }),
    streamUnit: onTodoUpdated({ listId: 'typed-meta-stream' }),
  };
};

describe('hook type inference', () => {
  it('should infer source value type in useLivonValue', () => {
    const todoEntity = createTodoEntity();
    const readTodos = createReadTodosSource(todoEntity);
    const unit = readTodos({ listId: 'todo-list-1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => readonly Todo[]>();
  });

  it('should infer action value type in useLivonValue', () => {
    const todoEntity = createTodoEntity();
    const updateTodo = createUpdateTodoAction(todoEntity);
    const unit = updateTodo({ listId: 'todo-list-1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => Todo | null>();
  });

  it('should infer stream value type in useLivonValue', () => {
    const todoEntity = createTodoEntity();
    const onTodoUpdated = createTodoStream(todoEntity);
    const unit = onTodoUpdated({ listId: 'todo-list-1' });
    const resolveValue = (currentUnit: typeof unit) => useLivonValue(currentUnit);

    expectTypeOf(resolveValue).toEqualTypeOf<(currentUnit: typeof unit) => Todo | null>();
  });

  it('should infer source status type in useLivonStatus', () => {
    const todoEntity = createTodoEntity();
    const readTodos = createReadTodosSource(todoEntity);
    const unit = readTodos({ listId: 'todo-list-1' });
    const resolveStatus = (currentUnit: typeof unit) => useLivonStatus(currentUnit);

    expectTypeOf(resolveStatus).toEqualTypeOf<(currentUnit: typeof unit) => UnitStatus>();
  });

  it('should infer draft status type in useLivonStatus', () => {
    const todoEntity = createTodoEntity();
    const readTodoDraft = createReadTodoDraft(todoEntity);
    const unit = readTodoDraft({ listId: 'todo-list-1' });
    const resolveStatus = (currentUnit: typeof unit) => useLivonStatus(currentUnit);

    expectTypeOf(resolveStatus).toEqualTypeOf<(currentUnit: typeof unit) => 'dirty' | 'clear'>();
  });

  it('should infer unknown meta by default in useLivonMeta', () => {
    const todoEntity = createTodoEntity();
    const readTodos = createReadTodosSource(todoEntity);
    const unit = readTodos({ listId: 'todo-list-1' });
    const resolveMeta = (currentUnit: typeof unit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveMeta).toEqualTypeOf<(currentUnit: typeof unit) => unknown>();
  });

  it('should preserve explicit source meta type in useLivonMeta', () => {
    const { sourceUnit } = createTypedMetaUnits();
    const resolveMeta = (currentUnit: typeof sourceUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveMeta).toEqualTypeOf<(currentUnit: typeof sourceUnit) => TodoMeta | null>();
  });

  it('should preserve explicit action meta type in useLivonMeta', () => {
    const { actionUnit } = createTypedMetaUnits();
    const resolveMeta = (currentUnit: typeof actionUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveMeta).toEqualTypeOf<(currentUnit: typeof actionUnit) => TodoMeta | null>();
  });

  it('should preserve explicit stream meta type in useLivonMeta', () => {
    const { streamUnit } = createTypedMetaUnits();
    const resolveMeta = (currentUnit: typeof streamUnit) => useLivonMeta(currentUnit);

    expectTypeOf(resolveMeta).toEqualTypeOf<(currentUnit: typeof streamUnit) => TodoMeta | null>();
  });

  it('should infer full source snapshot type in useLivonState', () => {
    const todoEntity = createTodoEntity();
    const readTodos = createReadTodosSource(todoEntity);
    const unit = readTodos({ listId: 'todo-list-1' });
    const resolveState = (currentUnit: typeof unit) => useLivonState(currentUnit);

    expectTypeOf(resolveState).toEqualTypeOf<
      (currentUnit: typeof unit) => ReturnType<typeof unit.getSnapshot>
    >();
  });

  it('should infer full draft snapshot type in useLivonState', () => {
    const todoEntity = createTodoEntity();
    const readTodoDraft = createReadTodoDraft(todoEntity);
    const unit = readTodoDraft({ listId: 'todo-list-1' });
    const resolveState = (currentUnit: typeof unit) => useLivonState(currentUnit);

    expectTypeOf(resolveState).toEqualTypeOf<
      (currentUnit: typeof unit) => ReturnType<typeof unit.getSnapshot>
    >();
  });
});
