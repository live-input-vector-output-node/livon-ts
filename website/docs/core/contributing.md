---
title: Contributing
sidebar_position: 5
---

For contributors and maintainers, this page defines the local development workflow and required quality gates.

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
pnpm qg
```

`qg` runs the full repository gate set via Turbo:
`check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, `build`.

For fast local loops, run only affected scope with the same gate graph:

```sh
pnpm qg:changed
```

Single-command Turbo pipeline for packages/apps:

```sh
pnpm run ci
```

Release artifact validation:

```sh
pnpm run release:check
```

Root quality-gate and verification commands use concise output by default:

- Success path: show Turbo task/package summaries instead of full tool logs.
- Failure path: show only the failing package/task logs and the relevant error locations.
- For deep debugging, rerun the failing package command directly or run the equivalent Turbo command with `--output-logs=full`.

Repository badges must use trusted externally hosted sources such as GitHub Actions, npm, Shields, or Libraries.io.
Do not add generated/self-hosted badge artifacts or badge workspaces back into the repository or CI.

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
pnpm exec vitest run --config vitest.workspace.ts --passWithNoTests
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

### 9. Generate package READMEs from docs

Package READMEs are generated from `website/docs/packages/*.md`.
Do not manually maintain duplicated package README content.
Canonical edits go into `website/docs/**`; generated README files are derived artifacts.

Generate:

```sh
pnpm turbo run gen:readmes
```

Validate sync:

```sh
pnpm turbo run check:readmes
```

## Tooling and build policy

Use default tool configs and standard commands first.

- Prefer native config files such as `rslib.config.ts`, `rsbuild.config.ts`, `vitest.*.config.ts`, `eslint.config.cjs`, and `tsconfig*.json`.
- Prefer standard tooling commands (`rslib`, `rsbuild`, `vitest`, `eslint`, `tsc`) in package scripts.
- Avoid custom wrapper scripts for normal build, lint, test, and typecheck flows.
- Keep package scripts atomic (single-tool command); orchestration belongs to Turborepo.

Use Turborepo as the monorepo execution layer:

- Cross-package sequencing, caching, and parallelism must be managed in `turbo.json`.
- Root workflows should call Turbo tasks (for example `pnpm run ci`) instead of bespoke orchestration scripts.
- Root `package.json` scripts must use `turbo run ...` and must not execute ad-hoc Node or shell commands directly.
- Root scripts must not hardcode `--filter`; when scoped execution is needed, the caller adds the filter at invocation time.
- Root quality-gate and verification scripts should use concise log output by default and reserve full logs for explicit debugging reruns.
- Shared automation belongs in dedicated workspace packages (for example `tools/policies`, `tools/gen`, `tools/release`).
- Package README synchronization is owned by `tools/readmes` and sourced from `website/docs/packages/*.md`.
- Publish-time package manifest cleanup is owned by `tools/release`; published tarballs must not ship `devDependencies`, local `development` export conditions, or unresolved `workspace:*` ranges.
- GitHub Actions used across multiple `.github/workflows/*.yml` files must use one consistent version per action. When updating workflow actions, align all workflows to the newest compatible version.
- Lint warning budgets are centralized in `configs/quality/lint-warning-budgets.json`; `eslint` scripts must use `--max-warnings` values from that file to prevent warning regressions.
- Shared recurring rules belong in `/docs/ai/root-gate`; package/folder deviations belong in `/docs/ai/specializations`.

Custom scripts are acceptable only when standard tooling cannot express required product behavior.
When that happens, document the reason in the relevant docs and keep scope minimal.

## Before every push (mandatory)

Run:

```sh
pnpm qg
```

Use the same gate set before opening a pull request.

## Merge and rebase conflict resolution

When resolving git conflicts in this repository, use `newest version wins` as the default rule.

- Keep the newest compatible version.
- If the conflict touches a shared dependency, workflow action, script, or config value that appears in multiple files, align all related files to that same newest compatible version.
- Keep the older side only when a higher-priority instruction or an explicit correctness, security, or build constraint makes the newer side invalid.

## Check command output policy

Root verification commands should optimize for signal, not raw log volume.

- On success, print short OK summaries.
- On failure, print the failing package/task and the concrete error locations.
- Do not dump full successful test, typecheck, lint, or build logs by default in local loops or CI.
- If full logs are needed for diagnosis, rerun the failing command explicitly with verbose output instead of making the default path noisy.

## Commit naming convention

Use this commit prefix pattern:

- `feature:` for new user-facing capabilities.
- `improvement:` for non-breaking behavior and quality improvements.
- `bug:` for defect fixes.
- `refactor:` for structural code changes without behavior change.
- `chore:` for tooling, docs, config, and maintenance tasks.

Examples:

```text
feature: add runtime explain payload tests
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

Update documentation whenever public behavior, API schemas, or workflows change.

For JSDoc `@see` links, use `https://livon.tech` as host prefix
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
- Version updates are created locally (`pnpm changeset` + `pnpm changeset:version`) and committed to `main`.
- Publish is executed in CI and starts automatically on `main` when `.changeset/**` or `**/CHANGELOG.md` changes.

Version management is handled with Changesets (fixed version group for all publishable `@livon/*` packages).

Lockstep versioning policy:

- Every `package.json` in this repository uses the same version value.
- This includes root, `apps/*`, `packages/*`, `tools/*`, and `website`.
- `pnpm check:policies` fails if any version deviates from the root `package.json` version.

```sh
pnpm changeset
pnpm changeset:version
```

`pnpm changeset:version` runs Changesets versioning and then syncs the root `package.json` version to the shared workspace version.
It also syncs any remaining workspace `package.json` files that are governed by repo-wide version parity but are not directly versioned by Changesets.

The publish workflow uses:

```sh
pnpm changeset:publish
```

CI publish behavior:

- `Publish Packages` can be started manually via workflow dispatch without any parameters.
- Tag handling is owned by Changesets:
  - in pre mode (`.changeset/pre.json`), Changesets publishes to the pre tag (for example `rc`)
  - outside pre mode, Changesets publishes to `latest`
- Pipeline always runs `lint`, `typecheck`, `test`, and `build` before publish.
- Pushes to `main` that change `.changeset/**` or `**/CHANGELOG.md` trigger publish automatically.

Recommended RC publish flow:

1. Keep pre mode active (`pnpm dlx @changesets/cli pre enter rc` once, then stay in pre mode).
2. Create release notes with `pnpm changeset`.
3. Apply versions with `pnpm changeset:version`.
4. Commit and push to `main` (auto publish), or trigger `Publish Packages` manually.

Recommended stable publish flow:

1. Exit pre mode with `pnpm dlx @changesets/cli pre exit`.
2. Create release notes with `pnpm changeset`.
3. Apply versions with `pnpm changeset:version`.
4. Commit and push to `main` (auto publish), or trigger `Publish Packages` manually.
