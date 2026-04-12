---
title: LIVON
slug: /
---

<p align="center" class="livon-badge-strip">
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="CI" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/secrets.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/secrets.yml?branch=main&label=gitleaks" alt="Secret Scan" /></a>
</p>
<p align="center" class="livon-badge-strip">
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="Vulnerability Scan" /></a>
  <a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a>
  <a href="https://www.bestpractices.dev/projects/12249"><img src="https://www.bestpractices.dev/projects/12249/badge" alt="OpenSSF Best Practices" /></a>
</p>
<p align="center" class="livon-badge-strip">
  <a href="https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts">
    <img src="https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts" alt="REUSE status" />
  </a>
  <a href="https://coveralls.io/github/live-input-vector-output-node/livon-ts?branch=main"><img src="https://coveralls.io/repos/github/live-input-vector-output-node/livon-ts/badge.svg?branch=main" alt="Coveralls Coverage" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

## LIVON in one sentence

LIVON is a TypeScript monorepo for schema-first APIs and deterministic realtime sync across backend and frontend.

## Why teams use LIVON

- One API contract for validation, execution, and generated client surfaces.
- Deterministic sync units (`source` / `action` / `stream`) for predictable state flow.
- Realtime-ready runtime with strict typing and docs-driven generation.
- Monorepo quality gates and security checks designed to block risky changes early.

## Monorepo quick map

| Area | What it contains | Start here |
| --- | --- | --- |
| Core docs | Product context, onboarding, governance, release flow | [Getting Started](/docs/core/getting-started) |
| Package docs | Runtime, schema, sync, adapters, CLI package guides | [Packages Index](/docs/packages) |
| Schema reference | Full API references for schema builders/combinators | [Schema APIs](/docs/schema) |
| Architecture docs | Runtime internals, flow, roadmap, technical decisions | [Runtime Design](/docs/technical/runtime-design) |
| Contributor rules | Gate checks, coding/testing standards, workflow contracts | [Contributing](/docs/core/contributing) |

## Package overview

| Package | Role in the stack | Docs |
| --- | --- | --- |
| `@livon/runtime` | Runtime composition and execution boundaries. | [runtime](/docs/packages/runtime) |
| `@livon/schema` | Schema builders, parsing, and contract typing. | [schema](/docs/packages/schema) |
| `@livon/sync` | Deterministic sync units for state/event workflows. | [sync](/docs/packages/sync) |
| `@livon/client` | Generated client API surfaces from server schema. | [client](/docs/packages/client) |
| `@livon/client-ws-transport` | Browser/client websocket transport adapter. | [client-ws-transport](/docs/packages/client-ws-transport) |
| `@livon/node-ws-transport` | Node websocket transport adapter. | [node-ws-transport](/docs/packages/node-ws-transport) |
| `@livon/react` | React integration utilities around LIVON sync/runtime. | [react](/docs/packages/react) |
| `@livon/cli` | Explain/sync CLI and generated client update tooling. | [cli](/docs/packages/cli) |
| `@livon/dlq-module` | Dead-letter queue runtime module for failure handling. | [dlq-module](/docs/packages/dlq-module) |

## Recommended reading paths

### New to LIVON

1. [Why Livon Exists](/docs/core/why-livon-exists)
2. [Getting Started](/docs/core/getting-started)
3. [Schema APIs](/docs/schema)
4. [@livon/runtime](/docs/packages/runtime)

### Building product features

1. [For Fullstack Developers](/docs/core/for-fullstack-developers)
2. [Backend / Frontend Symmetry](/docs/core/backend-frontend-symmetry)
3. [SchemaDoc & Generated JSDoc](/docs/core/schema-doc-and-generated-jsdoc)
4. [@livon/client](/docs/packages/client)

### Contributing to the monorepo

1. [Contributing](/docs/core/contributing)
2. [Testing and Quality](/docs/core/testing-and-quality)
3. [Governance and Rule Sources](/docs/core/governance)
4. [OpenSSF Best Practices (Passing)](/docs/core/openssf-best-practices)

## Security and release links

- [Security policy](/docs/core/security)
- [Support and feedback channels](/docs/core/support)
- [Release notes](/docs/core/release-notes)
- [AI control and routing rules](/docs/ai)
