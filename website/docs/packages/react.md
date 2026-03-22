---
title: "@livon/react"
sidebar_position: 9
---

[![npm](https://img.shields.io/npm/v/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Freact?label=dependencies)](https://libraries.io/npm/%40livon%2Freact)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Freact?label=package%20size)](https://www.npmjs.com/package/@livon/react)
[![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts)

## Purpose

[@livon/react](/docs/packages/react) is the React framework adapter for `@livon/sync` units.
It provides typed hooks for value, status, meta, run/start, stop, and source draft editing.
Keep framework-agnostic state and lifecycle behavior in `@livon/sync`; keep React integration here.

## Install

```sh
pnpm add @livon/react @livon/sync
```

## Hooks

```ts
import {
  useLivonDraft,
  useLivonMeta,
  useLivonRun,
  useLivonStatus,
  useLivonStop,
  useLivonValue,
} from '@livon/react';
```

- `useLivonValue(unit)` -> `snapshot.value`
- `useLivonStatus(unit)` -> `idle | loading | success | error`
- `useLivonMeta(unit)` -> `snapshot.meta`
- `useLivonRun(unit)` -> `unit.run(...)` for source/action, `unit.start(...)` for stream
- `useLivonStop(unit)` -> `unit.stop()`
- `useLivonDraft(sourceUnit)` -> `[setDraft, cleanDraft]`

## Unit-First DX in React

```ts
const unit = readProject({ templateId });

const run = useLivonRun(unit);
const stop = useLivonStop(unit);
const value = useLivonValue(unit);
const status = useLivonStatus(unit);
const meta = useLivonMeta(unit);

useEffect(() => {
  void run();
  return stop;
}, [run, stop]);
```

## Shared vs Isolated Search State

`@livon/react` follows the same sync identity rule:

- `scope` decides which store is shared
- `run(payload)` decides execution on that store

### Shared store (same unit)

```ts
const unit = searchUsers({ templateId });
const run = useLivonRun(unit);

// all components using this scope share the same store
void run({ search: 'alpha' });
void run({ search: 'beta' });
```

### Isolated stores (different units)

```ts
const alphaUnit = searchUsersByScope({ templateId, search: 'alpha' });
const betaUnit = searchUsersByScope({ templateId, search: 'beta' });

// different scopes => different stores
```

## Fullstack Example (CRUD + Realtime)

```ts
import { action, entity, source, stream } from '@livon/sync';
import {
  useLivonDraft,
  useLivonMeta,
  useLivonRun,
  useLivonStatus,
  useLivonStop,
  useLivonValue,
} from '@livon/react';
import { useEffect } from 'react';

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
  draft: 'global',
  destroyDelay: 250,
});

const readProject = source<ProjectScope, SearchPayload, Project, Project | null>({
  entity: projectEntity,
  run: async ({ scope, payload, upsertOne }) => {
    const project = await api.readProject({
      templateId: scope.templateId,
      search: payload.search,
    });

    upsertOne(project, { merge: true });
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
  source: readProject,
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

export const ProjectScreen = ({ templateId }: { templateId: string }) => {
  const readUnit = readProject({ templateId });
  const runRead = useLivonRun(readUnit);
  const stopRead = useLivonStop(readUnit);
  const project = useLivonValue(readUnit);
  const status = useLivonStatus(readUnit);
  const meta = useLivonMeta(readUnit);
  const [setDraft, cleanDraft] = useLivonDraft(readUnit);

  const createUnit = createProject({ templateId });
  const runCreate = useLivonRun(createUnit);
  const createStatus = useLivonStatus(createUnit);

  const streamUnit = onProjectUpdated({ templateId });
  const startStream = useLivonRun(streamUnit);
  const stopStream = useLivonStop(streamUnit);

  useEffect(() => {
    void runRead({ search: 'active' });
    startStream();

    return () => {
      stopStream();
      stopRead();
    };
  }, [runRead, startStream, stopRead, stopStream]);

  const onCreate = () => {
    void runCreate({ name: 'New Project' });
  };

  return {
    project,
    status,
    meta,
    setDraft,
    cleanDraft,
    createStatus,
    onCreate,
  };
};
```

## Listener Lifecycle

`useLivonValue`, `useLivonStatus`, and `useLivonMeta` subscribe through a shared tracked-unit counter.
When the last listener for a unit unmounts, `stop()` is scheduled with unit `destroyDelay`.

Destroy delay precedence:

1. unit (`source`/`action`/`stream`) `destroyDelay`
2. entity `destroyDelay`
3. default `250`

## Related pages

- [@livon/sync](sync)
- [Packages Overview](/docs/packages)
- [Architecture](/docs/technical/architecture)
