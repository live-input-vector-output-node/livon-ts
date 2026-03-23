/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from 'vitest';

import type { ActionRunContext } from './action.js';
import { action } from './action.js';
import { entity, type Entity } from './entity.js';
import { source } from './source.js';
import type { SourceRunContext } from './source.js';
import type { StreamRunContext } from './stream.js';
import { stream } from './stream.js';
import { transform } from './transform.js';
import type { UnitSnapshot } from './tracking/index.js';
import { view } from './view.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoScope {
  listId: string;
}

interface UpdateTodoPayload {
  title: string;
}

type AssertTrue<TValue extends true> = TValue;
type AssertFalse<TValue extends false> = TValue;
type IsEqual<TLeft, TRight> =
  (<TInput>() => TInput extends TLeft ? 1 : 2) extends
  (<TInput>() => TInput extends TRight ? 1 : 2)
    ? true
    : false;

type EntityHasUnifiedUpsert = 'upsert' extends keyof Entity<Todo> ? true : false;
type EntityHasUnifiedRemove = 'remove' extends keyof Entity<Todo> ? true : false;
type EntityHasUpsertOne = 'upsertOne' extends keyof Entity<Todo> ? true : false;
type EntityHasUpsertMany = 'upsertMany' extends keyof Entity<Todo> ? true : false;
type EntityHasRemoveOne = 'removeOne' extends keyof Entity<Todo> ? true : false;
type EntityHasRemoveMany = 'removeMany' extends keyof Entity<Todo> ? true : false;

type _entityHasNoUnifiedUpsert = AssertFalse<EntityHasUnifiedUpsert>;
type _entityHasNoUnifiedRemove = AssertFalse<EntityHasUnifiedRemove>;
type _entityHasUpsertOne = AssertTrue<EntityHasUpsertOne>;
type _entityHasUpsertMany = AssertTrue<EntityHasUpsertMany>;
type _entityHasRemoveOne = AssertTrue<EntityHasRemoveOne>;
type _entityHasRemoveMany = AssertTrue<EntityHasRemoveMany>;

type SourceRunHasEntityApi = 'entity' extends keyof SourceRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type SourceRunHasLegacyUpsertOne = 'upsertOne' extends keyof SourceRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type SourceRunHasLegacyUpsertMany = 'upsertMany' extends keyof SourceRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;

type _sourceRunHasEntityApi = AssertTrue<SourceRunHasEntityApi>;
type _sourceRunHasNoLegacyUpsertOne = AssertFalse<SourceRunHasLegacyUpsertOne>;
type _sourceRunHasNoLegacyUpsertMany = AssertFalse<SourceRunHasLegacyUpsertMany>;

type ActionRunHasEntityApi = 'entity' extends keyof ActionRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type ActionRunHasLegacyUpsertOne = 'upsertOne' extends keyof ActionRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type _actionRunHasEntityApi = AssertTrue<ActionRunHasEntityApi>;
type _actionRunHasNoLegacyUpsertOne = AssertFalse<ActionRunHasLegacyUpsertOne>;

type StreamRunHasEntityApi = 'entity' extends keyof StreamRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type StreamRunHasLegacyUpsertOne = 'upsertOne' extends keyof StreamRunContext<
  TodoScope,
  UpdateTodoPayload,
  Todo,
  Todo | null
>
  ? true
  : false;
type _streamRunHasEntityApi = AssertTrue<StreamRunHasEntityApi>;
type _streamRunHasNoLegacyUpsertOne = AssertFalse<StreamRunHasLegacyUpsertOne>;

const todosEntity = entity<Todo>({
  idOf: (value) => value.id,
});

const readTodos = source<TodoScope, undefined, Todo, readonly Todo[]>({
  entity: todosEntity,
  run: async () => undefined,
  defaultValue: [],
});

const readTodosUnit = readTodos({
  listId: 'type-check',
});

const updateTodo = action<TodoScope, UpdateTodoPayload, Todo, Todo | null>({
  entity: todosEntity,
  run: async () => undefined,
});

const updateTodoUnit = updateTodo({
  listId: 'type-check',
});

const onTodoChanged = stream<TodoScope, UpdateTodoPayload, Todo, Todo | null>({
  entity: todosEntity,
  run: async () => undefined,
});

const onTodoChangedUnit = onTodoChanged({
  listId: 'type-check',
});

type SourceUnitHasSet = 'set' extends keyof typeof readTodosUnit ? true : false;
type SourceUnitHasSetDraft = 'setDraft' extends keyof typeof readTodosUnit ? true : false;
type SourceUnitHasCleanDraft = 'cleanDraft' extends keyof typeof readTodosUnit ? true : false;
type SourceUnitHasDraft = 'draft' extends keyof typeof readTodosUnit ? true : false;
type SourceUnitDraftApi = typeof readTodosUnit extends { draft: infer TDraft } ? TDraft : never;
type SourceUnitHasDraftSet = SourceUnitDraftApi extends { set: unknown } ? true : false;
type SourceUnitHasDraftClean = SourceUnitDraftApi extends { clean: unknown } ? true : false;

type _sourceUnitHasNoSet = AssertFalse<SourceUnitHasSet>;
type _sourceUnitHasNoSetDraft = AssertFalse<SourceUnitHasSetDraft>;
type _sourceUnitHasNoCleanDraft = AssertFalse<SourceUnitHasCleanDraft>;
type _sourceUnitHasDraft = AssertTrue<SourceUnitHasDraft>;
type _sourceUnitHasDraftSet = AssertTrue<SourceUnitHasDraftSet>;
type _sourceUnitHasDraftClean = AssertTrue<SourceUnitHasDraftClean>;

type ActionUnitHasSet = 'set' extends keyof typeof updateTodoUnit ? true : false;
type StreamUnitHasSet = 'set' extends keyof typeof onTodoChangedUnit ? true : false;

type _actionUnitHasNoSet = AssertFalse<ActionUnitHasSet>;
type _streamUnitHasNoSet = AssertFalse<StreamUnitHasSet>;

const todoCountView = view<TodoScope, number>({
  out: async (rawContext: unknown) => {
    const context = rawContext as {
      scope: TodoScope;
      get: (unit: unknown) => Promise<UnitSnapshot<readonly Todo[]>>;
    };
    const todoSnapshot = await context.get(readTodos(context.scope));
    return todoSnapshot.value.length;
  },
  defaultValue: 0,
});

const todoCountViewUnit = todoCountView({
  listId: 'type-check',
});

type ViewUnitHasEffect = 'effect' extends keyof typeof todoCountViewUnit ? true : false;
type ViewGetIsSnapshot = ReturnType<typeof todoCountViewUnit.get> extends UnitSnapshot<number>
  ? true
  : false;

type _viewUnitHasEffect = AssertTrue<ViewUnitHasEffect>;
type _viewGetIsSnapshot = AssertTrue<ViewGetIsSnapshot>;

const todoTitleTransform = transform<TodoScope, UpdateTodoPayload, string>({
  out: async () => '',
  in: async () => undefined,
  defaultValue: '',
});

const todoTitleTransformUnit = todoTitleTransform({
  listId: 'type-check',
});

type TransformUnitHasEffect = 'effect' extends keyof typeof todoTitleTransformUnit ? true : false;
type TransformGetIsSnapshot = ReturnType<typeof todoTitleTransformUnit.get> extends UnitSnapshot<string>
  ? true
  : false;
type TransformSetPayload = Parameters<typeof todoTitleTransformUnit.set>[0];
type TransformSetPayloadMatches = IsEqual<TransformSetPayload, UpdateTodoPayload>;

type _transformUnitHasEffect = AssertTrue<TransformUnitHasEffect>;
type _transformGetIsSnapshot = AssertTrue<TransformGetIsSnapshot>;
type _transformSetPayloadMatches = AssertTrue<TransformSetPayloadMatches>;

if (false) {
  todosEntity.upsertOne({
    id: 'legacy-id',
    title: 'legacy-title',
    completed: false,
  });

  // @ts-expect-error entity unified upsert must not exist in split DX
  todosEntity.upsert({
    id: 'legacy-id',
    title: 'legacy-title',
    completed: false,
  });

  // @ts-expect-error source unit set must not exist in the new DX
  readTodosUnit.set([
    {
      id: 'legacy-id',
      title: 'legacy-title',
      completed: false,
    },
  ]);

  // @ts-expect-error source top-level draft setter must not exist in the new DX
  readTodosUnit.setDraft([
    {
      id: 'legacy-id',
      title: 'legacy-title',
      completed: false,
    },
  ]);

  // @ts-expect-error source top-level draft cleaner must not exist in the new DX
  readTodosUnit.cleanDraft();

  // @ts-expect-error action unit set must not exist in the new DX
  updateTodoUnit.set({
    id: 'legacy-id',
    title: 'legacy-title',
    completed: false,
  });

  // @ts-expect-error stream unit set must not exist in the new DX
  onTodoChangedUnit.set({
    id: 'legacy-id',
    title: 'legacy-title',
    completed: false,
  });
}

describe('dx type-level contracts', () => {
  describe('happy', () => {
    it('should compile type-level contracts for split DX surface', () => {
      expect(true).toBe(true);
    });
  });
});
