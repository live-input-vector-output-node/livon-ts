/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it } from 'vitest';

import type { ActionRunContext } from './action.js';
import { action } from './action.js';
import { entity, type Entity } from './entity.js';
import { source } from './source.js';
import type { SourceRunContext } from './source.js';
import type { StreamRunContext } from './stream.js';
import { stream } from './stream.js';
import type { UnitSnapshot } from './tracking/index.js';
import { transform } from './transform.js';
import { view } from './view.js';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

interface TodoIdentity {
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
type EntityHasRemoveOne = 'deleteOne' extends keyof Entity<Todo> ? true : false;
type EntityHasRemoveMany = 'deleteMany' extends keyof Entity<Todo> ? true : false;

type _entityHasNoUnifiedUpsert = AssertFalse<EntityHasUnifiedUpsert>;
type _entityHasNoUnifiedRemove = AssertFalse<EntityHasUnifiedRemove>;
type _entityHasUpsertOne = AssertTrue<EntityHasUpsertOne>;
type _entityHasUpsertMany = AssertTrue<EntityHasUpsertMany>;
type _entityHasRemoveOne = AssertTrue<EntityHasRemoveOne>;
type _entityHasRemoveMany = AssertTrue<EntityHasRemoveMany>;

type SourceRunHasEntityApi = 'entity' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunHasLegacyUpsertOne =
  'upsertOne' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
    ? true
    : false;
type SourceRunHasLegacyUpsertMany =
  'upsertMany' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
    ? true
    : false;
type SourceRunHasSet = 'set' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunHasValue = 'value' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunHasStatus = 'status' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunHasMeta = 'meta' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunHasContext = 'context' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type SourceRunSetAcceptsValue = SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>['set'] extends (
  input: Todo | null,
) => void
  ? true
  : false;
type SourceRunSetAcceptsUpdater = SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>['set'] extends (
  input: Todo | null | ((previous: Todo | null) => Todo | null),
) => void
  ? true
  : false;
type SourceRunHasReset = 'reset' extends keyof SourceRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;

type _sourceRunHasNoEntityApi = AssertFalse<SourceRunHasEntityApi>;
type _sourceRunHasTopLevelUpsertOne = AssertTrue<SourceRunHasLegacyUpsertOne>;
type _sourceRunHasTopLevelUpsertMany = AssertTrue<SourceRunHasLegacyUpsertMany>;
type _sourceRunHasTopLevelSet = AssertTrue<SourceRunHasSet>;
type _sourceRunHasBaseValue = AssertTrue<SourceRunHasValue>;
type _sourceRunHasBaseStatus = AssertTrue<SourceRunHasStatus>;
type _sourceRunHasBaseMeta = AssertTrue<SourceRunHasMeta>;
type _sourceRunHasBaseContext = AssertTrue<SourceRunHasContext>;
type _sourceRunSetAcceptsValue = AssertTrue<SourceRunSetAcceptsValue>;
type _sourceRunSetAcceptsUpdater = AssertTrue<SourceRunSetAcceptsUpdater>;
type _sourceRunHasTopLevelReset = AssertTrue<SourceRunHasReset>;

type ActionRunHasEntityApi = 'entity' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type ActionRunHasLegacyUpsertOne =
  'upsertOne' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
    ? true
    : false;
type ActionRunHasValue = 'value' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type ActionRunHasStatus = 'status' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type ActionRunHasMeta = 'meta' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type ActionRunHasContext = 'context' extends keyof ActionRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type _actionRunHasNoEntityApi = AssertFalse<ActionRunHasEntityApi>;
type _actionRunHasTopLevelUpsertOne = AssertTrue<ActionRunHasLegacyUpsertOne>;
type _actionRunHasBaseValue = AssertTrue<ActionRunHasValue>;
type _actionRunHasBaseStatus = AssertTrue<ActionRunHasStatus>;
type _actionRunHasBaseMeta = AssertTrue<ActionRunHasMeta>;
type _actionRunHasBaseContext = AssertTrue<ActionRunHasContext>;

type StreamRunHasEntityApi = 'entity' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type StreamRunHasLegacyUpsertOne =
  'upsertOne' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
    ? true
    : false;
type StreamRunHasValue = 'value' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type StreamRunHasStatus = 'status' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type StreamRunHasMeta = 'meta' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type StreamRunHasContext = 'context' extends keyof StreamRunContext<TodoIdentity, UpdateTodoPayload, Todo | null>
  ? true
  : false;
type _streamRunHasNoEntityApi = AssertFalse<StreamRunHasEntityApi>;
type _streamRunHasTopLevelUpsertOne = AssertTrue<StreamRunHasLegacyUpsertOne>;
type _streamRunHasBaseValue = AssertTrue<StreamRunHasValue>;
type _streamRunHasBaseStatus = AssertTrue<StreamRunHasStatus>;
type _streamRunHasBaseMeta = AssertTrue<StreamRunHasMeta>;
type _streamRunHasBaseContext = AssertTrue<StreamRunHasContext>;

const todosEntity = entity<Todo>({
  key: 'todos',
  idOf: (value) => value.id,
});

const readTodos = source({
  entity: todosEntity,
  mode: 'many',
})<TodoIdentity>({
  key: 'read-todos',
  run: async ({ upsertMany }) => {
    upsertMany([
      {
        id: 'todo-1',
        title: 'first',
        completed: false,
      },
    ]);
  },
  defaultValue: [],
});

const readTodosUnit = readTodos({
  listId: 'type-check',
});

const updateTodo = action({
  entity: todosEntity,
  mode: 'one',
})<TodoIdentity, UpdateTodoPayload>({
  key: 'update-todo',
  defaultValue: null,
  run: async ({ payload, upsertOne }) => {
    upsertOne({
      id: `todo-${payload.title}`,
      title: payload.title,
      completed: false,
    });
  },
});

const updateTodoUnit = updateTodo({
  listId: 'type-check',
});

const onTodoChanged = stream({
  entity: todosEntity,
  mode: 'one',
})<TodoIdentity, UpdateTodoPayload>({
  key: 'todo-changed',
  defaultValue: null,
  run: async ({ payload, upsertOne }) => {
    upsertOne({
      id: `todo-stream-${payload.title}`,
      title: payload.title,
      completed: false,
    });
  },
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
type SourceUnitHasReset = 'reset' extends keyof typeof readTodosUnit ? true : false;

type _sourceUnitHasNoSet = AssertFalse<SourceUnitHasSet>;
type _sourceUnitHasNoSetDraft = AssertFalse<SourceUnitHasSetDraft>;
type _sourceUnitHasNoCleanDraft = AssertFalse<SourceUnitHasCleanDraft>;
type _sourceUnitHasNoDraft = AssertFalse<SourceUnitHasDraft>;
type _sourceUnitHasDraftSet = AssertTrue<SourceUnitHasDraftSet>;
type _sourceUnitHasDraftClean = AssertTrue<SourceUnitHasDraftClean>;
type _sourceUnitHasNoReset = AssertFalse<SourceUnitHasReset>;

type ActionUnitHasSet = 'set' extends keyof typeof updateTodoUnit ? true : false;
type StreamUnitHasSet = 'set' extends keyof typeof onTodoChangedUnit ? true : false;

type _actionUnitHasNoSet = AssertFalse<ActionUnitHasSet>;
type _streamUnitHasNoSet = AssertFalse<StreamUnitHasSet>;

type SourceUnitValueMatchesEntityMode = IsEqual<
  ReturnType<typeof readTodosUnit.getSnapshot>['value'],
  readonly Todo[]
>;
type SourceUnitSnapshotHasIdentity =
  'identity' extends keyof ReturnType<typeof readTodosUnit.getSnapshot>
    ? true
    : false;
type ActionUnitValueMatchesEntityMode = IsEqual<
  ReturnType<typeof updateTodoUnit.getSnapshot>['value'],
  Todo | null
>;
type ActionUnitSnapshotHasIdentity =
  'identity' extends keyof ReturnType<typeof updateTodoUnit.getSnapshot>
    ? true
    : false;
type StreamUnitValueMatchesEntityMode = IsEqual<
  ReturnType<typeof onTodoChangedUnit.getSnapshot>['value'],
  Todo | null
>;
type StreamUnitSnapshotHasIdentity =
  'identity' extends keyof ReturnType<typeof onTodoChangedUnit.getSnapshot>
    ? true
    : false;

type _sourceUnitValueMatchesEntityMode = AssertTrue<SourceUnitValueMatchesEntityMode>;
type _sourceUnitSnapshotHasIdentity = AssertTrue<SourceUnitSnapshotHasIdentity>;
type _actionUnitValueMatchesEntityMode = AssertTrue<ActionUnitValueMatchesEntityMode>;
type _actionUnitSnapshotHasIdentity = AssertTrue<ActionUnitSnapshotHasIdentity>;
type _streamUnitValueMatchesEntityMode = AssertTrue<StreamUnitValueMatchesEntityMode>;
type _streamUnitSnapshotHasIdentity = AssertTrue<StreamUnitSnapshotHasIdentity>;

const todoCountView = view<TodoIdentity, number>({
  out: async ({ get, identity }) => {
    const todoSnapshot: UnitSnapshot<readonly Todo[]> = await get(readTodos(identity));
    return todoSnapshot.value.length;
  },
  defaultValue: 0,
});

const todoCountViewUnit = todoCountView({
  listId: 'type-check',
});

type ViewUnitHasSubscribe = 'subscribe' extends keyof typeof todoCountViewUnit ? true : false;
type ViewUnitHasEffect = 'effect' extends keyof typeof todoCountViewUnit ? true : false;
type ViewGetSnapshotIsSnapshot = ReturnType<typeof todoCountViewUnit.getSnapshot> extends UnitSnapshot<number>
  ? true
  : false;
type ViewRunReturnsSnapshot = ReturnType<typeof todoCountViewUnit.run> extends Promise<UnitSnapshot<number>>
  ? true
  : false;

type _viewUnitHasSubscribe = AssertTrue<ViewUnitHasSubscribe>;
type _viewUnitHasNoLegacyEffect = AssertFalse<ViewUnitHasEffect>;
type _viewGetSnapshotIsSnapshot = AssertTrue<ViewGetSnapshotIsSnapshot>;
type _viewRunReturnsSnapshot = AssertTrue<ViewRunReturnsSnapshot>;

const todoTitleTransform = transform<TodoIdentity, UpdateTodoPayload, string>({
  out: async ({ get, identity }) => {
    const todoSnapshot = await get(updateTodo(identity));
    return todoSnapshot.value?.title ?? '';
  },
  in: async ({ payload, identity, set }) => {
    await set(updateTodo(identity), payload);
  },
  defaultValue: '',
});

const todoTitleTransformUnit = todoTitleTransform({
  listId: 'type-check',
});

type TransformUnitHasSubscribe = 'subscribe' extends keyof typeof todoTitleTransformUnit ? true : false;
type TransformUnitHasLegacySet = 'set' extends keyof typeof todoTitleTransformUnit ? true : false;
type TransformGetSnapshotIsSnapshot =
  ReturnType<typeof todoTitleTransformUnit.getSnapshot> extends UnitSnapshot<string>
    ? true
    : false;
type TransformRunPayload = Parameters<typeof todoTitleTransformUnit.run>[0];
type TransformRunPayloadMatches = IsEqual<TransformRunPayload, UpdateTodoPayload>;

type _transformUnitHasSubscribe = AssertTrue<TransformUnitHasSubscribe>;
type _transformUnitHasNoLegacySet = AssertFalse<TransformUnitHasLegacySet>;
type _transformGetSnapshotIsSnapshot = AssertTrue<TransformGetSnapshotIsSnapshot>;
type _transformRunPayloadMatches = AssertTrue<TransformRunPayloadMatches>;

describe('dx type-level contracts', () => {
  describe('happy', () => {
    it('should compile type-level contracts for split DX surface', () => {
      expect(true).toBe(true);
    });

    it('should not expose entity on run context at runtime', async () => {
      let sourceContextHasEntity = false;
      let actionContextHasEntity = false;
      let streamContextHasEntity = false;

      const runtimeSource = source({
        entity: todosEntity,
        mode: 'many',
      })<TodoIdentity>({
        key: 'runtime-source-context-no-entity',
        defaultValue: [],
        run: async (context) => {
          sourceContextHasEntity = Object.prototype.hasOwnProperty.call(context, 'entity');
          context.upsertMany([
            {
              id: 'runtime-source',
              title: 'runtime-source',
              completed: false,
            },
          ]);
        },
      });

      const runtimeAction = action({
        entity: todosEntity,
        mode: 'one',
      })<TodoIdentity, UpdateTodoPayload>({
        key: 'runtime-action-context-no-entity',
        defaultValue: null,
        run: async (context) => {
          actionContextHasEntity = Object.prototype.hasOwnProperty.call(context, 'entity');
          context.upsertOne({
            id: 'runtime-action',
            title: context.payload.title,
            completed: false,
          });
        },
      });

      const runtimeStream = stream({
        entity: todosEntity,
        mode: 'one',
      })<TodoIdentity, UpdateTodoPayload>({
        key: 'runtime-stream-context-no-entity',
        defaultValue: null,
        run: async (context) => {
          streamContextHasEntity = Object.prototype.hasOwnProperty.call(context, 'entity');
          context.upsertOne({
            id: 'runtime-stream',
            title: context.payload.title,
            completed: false,
          });
        },
      });

      await runtimeSource({ listId: 'runtime-context-check' }).getSnapshot().load();
      await runtimeAction({ listId: 'runtime-context-check' }).getSnapshot().submit({
        title: 'updated',
      });
      await runtimeStream({ listId: 'runtime-context-check' }).getSnapshot().start({
        title: 'updated-stream',
      });

      expect(sourceContextHasEntity).toBe(false);
      expect(actionContextHasEntity).toBe(false);
      expect(streamContextHasEntity).toBe(false);
    });

    it('should reject legacy APIs at type-level only', () => {
      const assertLegacyApisDoNotExist = () => {
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

        source({
          entity: todosEntity,
          mode: 'many',
        })<TodoIdentity>({
          key: 'source-must-not-expose-entity-on-run-context',
          defaultValue: [],
          // @ts-expect-error run context must expose top-level helpers, not entity API
          run: async ({ entity }) => {
            entity.upsertMany([]);
          },
        });

        action({
          entity: todosEntity,
          mode: 'one',
        })<TodoIdentity, UpdateTodoPayload>({
          key: 'action-must-not-expose-entity-on-run-context',
          defaultValue: null,
          // @ts-expect-error run context must expose top-level helpers, not entity API
          run: async ({ entity }) => {
            entity.upsertOne({
              id: 'legacy-id',
              title: 'legacy-title',
              completed: false,
            });
          },
        });

        stream({
          entity: todosEntity,
          mode: 'one',
        })<TodoIdentity, UpdateTodoPayload>({
          key: 'stream-must-not-expose-entity-on-run-context',
          defaultValue: null,
          // @ts-expect-error run context must expose top-level helpers, not entity API
          run: async ({ entity }) => {
            entity.upsertOne({
              id: 'legacy-id',
              title: 'legacy-title',
              completed: false,
            });
          },
        });
      };

      expect(typeof assertLegacyApisDoNotExist).toBe('function');
    });
  });
});
