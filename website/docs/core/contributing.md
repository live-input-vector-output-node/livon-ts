---
title: Contributing
sidebar_position: 5
---

## Developer quickstart

### 1. Clone and install workspace dependencies

```sh
git clone <repo-url>
cd new_livon
pnpm install
```

### 2. Install LIVON in your own app (outside this monorepo)

Server stack:

```sh
pnpm add @livon/runtime @livon/schema @livon/node-ws-transport
```

Client stack:

```sh
pnpm add @livon/runtime @livon/client @livon/client-ws-transport
```

Optional generator CLI:

```sh
pnpm add -D @livon/cli
```

### 3. Run local development apps in this repository

Run server app:

```sh
pnpm -C apps/server dev
```

Run client app:

```sh
pnpm -C apps/client dev
```

Default local endpoints:

- Client app: `http://127.0.0.1:3001`
- Server WS endpoint: `ws://127.0.0.1:3002/ws`

Run client API generation watcher:

```sh
pnpm -C apps/client gen:client:watch
```

Run monorepo dev orchestration:

```sh
pnpm dev
```

### 4. Build and run quality gates

```sh
pnpm check:policies
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

### 5. Run package-local checks during development

Example unit test run:

```sh
pnpm -C packages/runtime test:unit
```

Example integration test run:

```sh
pnpm -C apps/server test:integration
```

Monorepo test run via central Vitest workspace config:

```sh
pnpm test
pnpm run test --config vitest.workspace.ts
```

Coverage example:

```sh
pnpm -C packages/schema exec vitest run -c vitest.unit.config.ts --coverage
```

Packages without test files currently return `No test files found` for direct `test:unit` calls.
For local verification in those packages, use:

```sh
pnpm -C <package-path> exec vitest run -c vitest.unit.config.ts --passWithNoTests
```

### 6. Build and run docs locally

```sh
pnpm docs
```

### 7. Build only one package while iterating

```sh
pnpm -C packages/schema build
pnpm -C packages/runtime build:watch
```

### 8. Generate client API manually

```sh
pnpm gen node schema
pnpm -C apps/client gen:client
```

## Before opening a pull request

Run:

```sh
pnpm check:policies
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Commit naming convention

Use this commit prefix pattern:

- `feature:` for new user-facing capabilities.
- `improvement:` for non-breaking behavior and quality improvements.
- `bug:` for defect fixes.
- `refactor:` for structural code changes without behavior change.
- `chore:` for tooling, docs, config, and maintenance tasks.

Examples:

```text
feature: add schema runtime explain payload tests
improvement: increase schema branch coverage for operation runner
bug: fix field operation input normalization
refactor: split api subscription normalization helpers
chore: update vitest workspace config
```

## Parameters

The commands above are root quality-gate commands and do not require additional parameters.

For package-local commands:

- `-C <path>`: run command in a specific workspace package/app directory.
- `--filter <workspace-selector>`: run command against a selected workspace package.

Update documentation whenever public behavior, API contracts, or workflows change.

For JSDoc `@see` links, use `https://live-input-vector-output-node.github.io/livon-ts` as host prefix
to keep links stable against the published docs site.

## Rule sources

- [Governance and Rule Sources](governance)
- [Coding Style Guide](coding-style-guide)
- [Definition of Done](definition-of-done)
- [Project Context](project-context)
- [Governance Change History](change-history)
- [Getting Started](getting-started)
- [Testing and Quality](testing-and-quality)

## GitHub Pages deployment

The docs site deploy pipeline is in `.github/workflows/docs-pages.yml`.

It:

1. Installs dependencies with pnpm cache.
2. Builds Docusaurus in `website/`.
3. Uploads static output as Pages artifact.
4. Deploys to GitHub Pages.

`docusaurus.config.ts` automatically adapts `url` and `baseUrl` in GitHub Actions mode.

## Package publishing

Publishing is handled by `.github/workflows/publish.yml`.

Requirements:

- `NPM_TOKEN` repository secret.
- Valid package versions (no duplicate version publish).
- Build passes for all `packages/*`.
