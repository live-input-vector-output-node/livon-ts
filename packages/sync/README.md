<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/sync


[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)

## Purpose

[@livon/sync](https://livon.tech/docs/packages/sync) is the core sync layer for entity-centric state with three unit types:

- `source` for reads and cache-aware refetch flows
- `action` for writes and mutations
- `stream` for realtime subscriptions

## Install

```sh
pnpm add @livon/sync
```

## Core DX

```ts
import { action, entity, source, stream } from '@livon/sync';

interface Project {
  id: string;
  name: string;
  templateId: string;
}

interface ProjectScope {
  templateId: string;
}

interface SearchPayload {
  search: string;
}

interface CreateProjectPayload {
  name: string;
}

const projectEntity = entity<Project>({
  idOf: (value) => value.id,
  ttl: 30_000,
  draft: 'global',
  destroyDelay: 250,
});

const readProjects = source<ProjectScope, SearchPayload, Project, readonly Project[]>({
  entity: projectEntity,
  ttl: 60_000,
  run: async ({ scope, payload, upsertMany }) => {
    const projects = await api.readProjects({
      templateId: scope.templateId,
      search: payload.search,
    });

    upsertMany(projects, { merge: true });
  },
});

const createProject = action<ProjectScope, CreateProjectPayload, Project, Project | null>({
  entity: projectEntity,
  run: async ({ scope, payload, upsertOne }) => {
    const created = await api.createProject({
      templateId: scope.templateId,
      name: payload.name,
    });

    upsertOne(created);
  },
});

const onProjectUpdated = stream<ProjectScope, undefined, Project, Project | null>({
  entity: projectEntity,
  source: readProjects,
  run: async ({ scope, upsertOne, refetch }) => {
    const subscription = api.subscribeProjectUpdated({
      templateId: scope.templateId,
    });

    subscription.observe(({ data, error }) => {
      if (error || !data) {
        return;
      }

      upsertOne(data, { merge: true });
      void refetch(scope)();
    });

    return subscription.unsubscribe;
  },
});
```

## Unit Identity Rule

`scope` defines unit identity. `run(payload)` defines execution.

- Same `scope` => same unit/store instance
- Different `scope` => different unit/store instance

### Shared store with different executions

Use `run(payload)` when all consumers should share one store:

```ts
const unit = readProjects({ templateId: 't-1' });

await unit.run({ search: 'alpha' });
await unit.run({ search: 'beta' });

// same unit, same shared store, latest run updates that store
```

### Separate stores per search result

Put search into `scope` when each search result needs its own store:

```ts
interface ProjectSearchScope {
  templateId: string;
  search: string;
}

const readProjectsByScope = source<ProjectSearchScope, undefined, Project, readonly Project[]>({
  entity: projectEntity,
  run: async ({ scope, upsertMany }) => {
    const projects = await api.readProjects(scope);
    upsertMany(projects);
  },
});

const alphaUnit = readProjectsByScope({ templateId: 't-1', search: 'alpha' });
const betaUnit = readProjectsByScope({ templateId: 't-1', search: 'beta' });

// different scopes => different stores
```

## Runtime Usage

```ts
const readUnit = readProjects({ templateId: 't-1' });
const createUnit = createProject({ templateId: 't-1' });
const streamUnit = onProjectUpdated({ templateId: 't-1' });

await readUnit.run({ search: 'active' });
const value = readUnit.get();

await createUnit.run({ name: 'New Project' });

streamUnit.start();
streamUnit.stop();

const removeListener = readUnit.effect((snapshot) => {
  // snapshot.value
  // snapshot.status: idle | loading | success | error
  // snapshot.meta
  // snapshot.context
});

removeListener?.();
readUnit.destroy();
```

## API Summary

### `entity({ ... })`

- `idOf`: required id extractor
- `ttl`: optional entity ttl fallback
- `draft`: optional draft mode (`global` | `scoped` | `off`)
- `destroyDelay`: optional default destroy delay for units using this entity
- `cache`: optional cache defaults (`key`, `ttl`, `storage`)

Entity mutation methods exposed to units:

- `upsertOne`, `upsertMany`
- `removeOne`, `removeMany`

### `source({ ... })`

- config: `entity`, optional `ttl`, `draft`, `cache`, `destroyDelay`, `onDestroy`, `defaultValue`, `update`, `run`
- unit from `source(scope)`:
  - `run(payload?)`
  - `force(payload?)`
  - `refetch(scopeInput?)(payloadInput?)`
  - `get`, `set`
  - `setDraft`, `cleanDraft`
  - `effect`, `stop`, `destroy`

### `action({ ... })`

- config: `entity`, optional `destroyDelay`, `defaultValue`, `update`, `run`
- unit from `action(scope)`:
  - `run(payload?)`
  - `get`, `set`
  - `effect`, `stop`, `destroy`

### `stream({ ... })`

- config: `entity`, optional `source`, `destroyDelay`, `defaultValue`, `update`, `run`
- unit from `stream(scope)`:
  - `start(payload?)`
  - `get`, `set`
  - `effect`, `stop`, `destroy`

`run` may return a cleanup function for all unit types.
That cleanup executes on `stop()`/`destroy()`.

## Advanced Tracking API (framework adapters)

`@livon/sync` also exports tracking helpers used by adapter packages:

- `subscribeTrackedUnit`
- `readTrackedUnitSnapshot`
- `resetTrackedUnit`

## Related pages

- [@livon/react](https://livon.tech/docs/packages/react)
- [Packages Overview](https://livon.tech/docs/packages)
- [Architecture](https://livon.tech/docs/technical/architecture)
