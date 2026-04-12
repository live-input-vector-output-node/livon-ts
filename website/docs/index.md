---
title: Documentation
slug: /
---

<p align="center" class="livon-badge-strip">
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="CI" /></a>
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

## Package badges

### Core

<section className="livon-badge-section">
  <div className="livon-badge-grid">
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/runtime</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/runtime"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fruntime" alt="@livon/runtime npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/runtime Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/runtime CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/runtime"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fruntime" alt="@livon/runtime license" /></a></div>
    </article>
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/schema</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/schema"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fschema" alt="@livon/schema npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/schema Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/schema CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/schema"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fschema" alt="@livon/schema license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="https://www.npmjs.com/package/msgpackr"><code>msgpackr</code></a></div>
      </div>
    </article>
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/sync</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/sync"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fsync" alt="@livon/sync npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/sync Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/sync CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/sync"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fsync" alt="@livon/sync license" /></a></div>
    </article>
  </div>
</section>

### Runtime Adapters

<section className="livon-badge-section">
  <div className="livon-badge-grid">
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/client</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/client"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fclient" alt="@livon/client npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/client Vulnerability scan" /></a> <a href="https://www.bestpractices.dev/projects/12249"><img className="livon-badge-image" src="https://www.bestpractices.dev/projects/12249/badge" alt="OpenSSF Best Practices" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/client CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/client"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fclient" alt="@livon/client license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/runtime"><code>@livon/runtime</code></a></div>
      </div>
    </article>
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/client-ws-transport</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/client-ws-transport"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fclient-ws-transport" alt="@livon/client-ws-transport npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/client-ws-transport Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/client-ws-transport CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/client-ws-transport"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fclient-ws-transport" alt="@livon/client-ws-transport license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/client"><code>@livon/client</code></a> <a href="/docs/packages/runtime"><code>@livon/runtime</code></a> <a href="https://www.npmjs.com/package/msgpackr"><code>msgpackr</code></a></div>
      </div>
    </article>
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/node-ws-transport</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/node-ws-transport"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fnode-ws-transport" alt="@livon/node-ws-transport npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/node-ws-transport Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/node-ws-transport CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/node-ws-transport"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fnode-ws-transport" alt="@livon/node-ws-transport license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/runtime"><code>@livon/runtime</code></a> <a href="https://www.npmjs.com/package/msgpackr"><code>msgpackr</code></a> <a href="https://www.npmjs.com/package/ws"><code>ws</code></a></div>
      </div>
    </article>
  </div>
</section>

### Frontend & Tooling

<section className="livon-badge-section">
  <div className="livon-badge-grid">
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/react</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/react"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Freact" alt="@livon/react npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/react Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/react CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/react"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Freact" alt="@livon/react license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/sync"><code>@livon/sync</code></a> <a href="https://www.npmjs.com/package/react"><code>react</code></a></div>
      </div>
    </article>
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/cli</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/cli"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fcli" alt="@livon/cli npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/cli Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/cli CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/cli"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fcli" alt="@livon/cli license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/client"><code>@livon/client</code></a> <a href="https://www.npmjs.com/package/@rslib/core"><code>@rslib/core</code></a> <a href="https://www.npmjs.com/package/msgpackr"><code>msgpackr</code></a> <a href="https://www.npmjs.com/package/ws"><code>ws</code></a></div>
      </div>
    </article>
  </div>
</section>

### Support

<section className="livon-badge-section">
  <div className="livon-badge-grid">
    <article className="livon-badge-card">
      <h4 className="livon-badge-card-title"><code>@livon/dlq-module</code></h4>
      <div className="livon-badge-row"><a href="https://www.npmjs.com/package/@livon/dlq-module"><img className="livon-badge-image" src="https://img.shields.io/npm/v/%40livon%2Fdlq-module" alt="@livon/dlq-module npm version" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan" alt="@livon/dlq-module Vulnerability scan" /></a> <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml"><img className="livon-badge-image" src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci" alt="@livon/dlq-module CI" /></a></div>
      <div className="livon-badge-row livon-badge-row--secondary"><a href="https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts"><img className="livon-badge-image" src="https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge" alt="OpenSSF Scorecard" /></a> <a href="https://www.npmjs.com/package/@livon/dlq-module"><img className="livon-badge-image" src="https://img.shields.io/npm/l/%40livon%2Fdlq-module" alt="@livon/dlq-module license" /></a></div>
      <div className="livon-tech-meta">
        <span className="livon-tech-label">Related libraries</span>
        <div className="livon-badge-row livon-tech-row"><a href="/docs/packages/runtime"><code>@livon/runtime</code></a></div>
      </div>
    </article>
  </div>
</section>
