---
title: Documentation
slug: /
---

<p align="center" class="livon-badge-strip">
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="CI" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=quality" alt="Quality" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/secrets.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/secrets.yml?branch=main&label=gitleaks" alt="Secret Scan" /></a>
</p>
<p align="center" class="livon-badge-strip">
  <a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a>
  <a href="https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts">
    <img src="https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts" alt="REUSE status" />
  </a>
  <a href="https://www.bestpractices.dev/projects/12249"><img src="https://www.bestpractices.dev/projects/12249/badge" alt="OpenSSF Best Practices" /></a>
</p>
<p align="center" class="livon-badge-strip">
  <a href="https://coveralls.io/github/live-input-vector-output-node/livon-ts?branch=main"><img src="https://coveralls.io/repos/github/live-input-vector-output-node/livon-ts/badge.svg?branch=main" alt="Coveralls Coverage" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="Vulnerability Scan" /></a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/blob/main/LICENSE.md"><img src="https://img.shields.io/badge/license-MIT-green" alt="License" /></a>
</p>

## LIVON

### The real-time runtime with API sync for full-stack systems

Realtime API interfaces that stay in sync.
Type-safe, validated payloads across frontend and backend.
Generated client APIs with JSDoc and sync workflow.

## What problem does LIVON solve?

Most teams duplicate the same interface definitions across:

- transport payloads
- runtime logic
- operation interfaces
- publish/subscribe event payloads
- generated client types and docs

That slows delivery, lets invalid data slip into runtime paths, and makes docs stale.

## Why this matters

Data mismatches usually appear late, when multiple teams are already blocked.
LIVON runs these checks when data moves between systems and keeps handlers validated-by-default.

## Who should care

- Engineers building frontend apps, backend services, and realtime features.
- Engineering managers who need predictable cross-team delivery.

## Client sync is required for generated client usage

If your client runtime uses the generated `api` module from `@livon/client`, `@livon/cli` sync is a required step.
Without sync, the generated client API file is missing or outdated, and the client cannot stay aligned with the server interface.

### Fast path

1. Mount server schema with explain enabled:

```ts
schemaModule(serverSchema, {explain: true});
```

`serverSchema` is the direct output of `api(...)` or `composeApi(...)`.
No additional schema-module input wrapper is required.

2. Run sync with your app command:

```sh
livon \
  --endpoint ws://127.0.0.1:3002/ws \
  --out src/generated/api.ts \
  --poll 2000 \
  -- pnpm dev
```

In linked mode, LIVON uses kill-all semantics: if either process exits, both stop.

3. Mount client runtime with generated module:

```ts
runtime(clientWsTransport({url: 'ws://127.0.0.1:3002/ws'}), api);
```

### Parameters in this flow

`schemaModule(serverSchema, {explain})`:

- `serverSchema` (`Api | ComposedApi`): server API schema bundle from `api(...)` or `composeApi(...)`.
- `explain` (`boolean`): enables explain metadata endpoint for sync.

`livon --endpoint ... --out ... --poll ... -- <command>`:

- `--endpoint` (`string`): explain source endpoint.
- `--out` (`string`): generated client module path.
- `--poll` (`number`): sync interval in milliseconds.
- `--` (delimiter): separates LIVON flags from the linked command.
- `<command>` (`string`): starts your app process after sync starts.

## One schema interface, full lifecycle

This example is intentionally minimal: it uses one simple `and` composition to extend input with an id.

```ts
import {
  and,
  api,
  object,
  operation,
  string,
  subscription,
} from '@livon/schema';
import {runtime} from '@livon/runtime';
import {schemaModule} from '@livon/schema';

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    author: string().min(2),
    text: string().min(1),
  },
  doc: {
    summary: 'Message payload',
    example: {author: 'Alice', text: 'Hello'},
  },
});

const WithId = object({
  name: 'WithId',
  shape: {
    id: string(),
  },
});

const MessageWithId = and({
  left: MessageInput,
  right: WithId,
});

const sendMessage = operation({
  input: MessageInput,
  output: MessageWithId,
  exec: async (input) => ({...input, id: 'msg-1'}),
  publish: {
    onMessage: (output) => output,
  },
});

const ChatApi = api({
  operations: {sendMessage},
  subscriptions: {onMessage: subscription({payload: MessageWithId})},
});

export const serverSchema = ChatApi;
runtime(schemaModule(serverSchema, {explain: true}));

const incomingInput: unknown = {author: 'Alice', text: 'Hello', id: 'msg-1'};
const parsed = MessageWithId.parse(incomingInput);
const typed = MessageWithId.typed({
  author: 'Alice',
  text: 'Hello',
  id: 'msg-1',
});

// Generated client usage
// await api.sendMessage({ author: 'Alice', text: 'Hello' });
// api({ onMessage: (payload) => payload.id });
```

### Parameters in this example

`object({...})`:

- `name` (`string`): schema identifier.
- `shape` (`Record<string, Schema>`): field schema map.
- `doc` (`SchemaDoc`, optional): summary/example metadata used by generated JSDoc.

`and({...})`:

- `left` (`Schema`): base schema.
- `right` (`Schema`): extension schema.
- `name` (`string`, optional): explicit composed type name.

`operation({...})`:

- `input` (`Schema`): request schema for incoming data.
- `output` (`Schema`): response schema before it is sent.
- `exec` (`(input, ctx) => result`): operation logic receiving validated input.
- `publish` (`Record<string, (output) => payload>`): publish mapping from operation output to subscription payload.

`MessageWithId.parse(incomingInput)`:

- `incomingInput` (`unknown`): untrusted incoming data to validate at runtime.

`MessageWithId.typed(value)`:

- `value` (`MessageWithId` shape): compile-time aligned value still checked against runtime constraints.

### Generated JSDoc output (generator format)

```ts
/**
 * Operation: sendMessage.
 * Constraints: publish=["onMessage"], request="MessageInput", response="MessageWithId".
 * Output type: MessageWithId.
 * Input type: MessageInput.
 * @param input - MessageInput request payload.
 * See {@link MessageInput}.
 * @returns MessageWithId operation result.
 * See {@link MessageWithId}.
 * Publishes events: onMessage.
 * @example
 * await client.sendMessage({ author: "Alice", text: "Hello" })
 * @example
 * sendMessage({ author: "Alice", text: "Hello" }: MessageInput): MessageWithId
 */
sendMessage(input: MessageInput): Promise<MessageWithId>;

/**
 * Subscription callback for "onMessage".
 * Output type: MessageWithId.
 * @param payload - MessageWithId payload emitted for "onMessage".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link MessageWithId} and {@link ClientHandlerContext}.
 * @example
 * api({ onMessage: (payload) => payload.id });
 */
onMessage?(payload: MessageWithId, ctx: ClientHandlerContext): void;
```

## Core Concepts

- [Why Livon Exists](/docs/core/why-livon-exists)
- [Validated by Default](/docs/core/validated-by-default)
- [parse vs typed](/docs/core/parse-vs-typed)
- [Backend / Frontend Symmetry](/docs/core/backend-frontend-symmetry)
- [SchemaDoc & Generated JSDoc](/docs/core/schema-doc-and-generated-jsdoc)
- [How Livon Differs](/docs/core/why-livon-exists#how-livon-differs-from-other-tools)
- [When Not to Use Livon](/docs/core/when-not-to-use-livon)

## Next sections

- [Start Here](/docs/core/getting-started): quickest path from first install to working runtime + client sync.
- [Guides](/docs/core/for-fullstack-developers): role-focused implementation paths for teams.
- [Reference](/docs/packages): package docs and full schema API reference.
- [Technical](/docs/technical/runtime-design): runtime architecture and event flow.
- [Contribution](/docs/core/contributing): quality gates, workflows, and governance.
- [Community](/docs/core/support): support channels, conduct policy, and security reporting.
- [Release Notes](/docs/core/release-notes): human-readable summaries for each release line.
- [OpenSSF Passing](/docs/core/openssf-best-practices): evidence map for badge criteria.
- [AI Control](/docs/ai): agent routing, scoped context, and gate-based enforcement.

## Package Overview

| Package | Purpose | Docs |
| --- | --- | --- |
| `@livon/runtime` | Runtime module composition and execution boundaries. | [runtime](/docs/packages/runtime) |
| `@livon/schema` | Schema builders, validation, and type-safe API contracts. | [schema](/docs/packages/schema) |
| `@livon/sync` | Deterministic sync units (`source` / `action` / `stream`). | [sync](/docs/packages/sync) |
| `@livon/client` | Generated client API surface for frontend/backend integration. | [client](/docs/packages/client) |
| `@livon/client-ws-transport` | WebSocket transport adapter for LIVON clients. | [client-ws-transport](/docs/packages/client-ws-transport) |
| `@livon/node-ws-transport` | WebSocket transport adapter for Node.js servers. | [node-ws-transport](/docs/packages/node-ws-transport) |
| `@livon/react` | React hooks and adapter utilities for LIVON sync/runtime. | [react](/docs/packages/react) |
| `@livon/cli` | CLI for schema explain/sync and generated client updates. | [cli](/docs/packages/cli) |
| `@livon/dlq-module` | Dead-letter queue runtime module for failed processing paths. | [dlq-module](/docs/packages/dlq-module) |
