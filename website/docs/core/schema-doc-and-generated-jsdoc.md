---
title: SchemaDoc & Generated JSDoc
sidebar_position: 6
---

In LIVON, the schema is the living documentation of the system.

## Rule

Every schema should include a `doc` object with concise summary and example.

If no `doc` object is provided, LIVON generates a minimal default JSDoc example so generated client surfaces remain documented.

## Schema with doc metadata

```ts
import {object, string} from '@livon/schema';

const Message = object({
  name: 'Message',
  shape: {
    text: string(),
  },
  doc: {
    summary: 'Message payload',
    example: {text: 'Hello'},
  },
});
```

### Parameters in this example

`object({...})`:

- `name` (`string`): schema identifier used in generated output.
- `shape` (`Record<string, Schema>`): schema field map.
- `doc` (`SchemaDoc`): documentation metadata for generated client JSDoc.

`doc`:

- `summary` (`string`): short purpose text.
- `example` (`unknown`): concrete payload example for generated docs.

## Generated client output (actual format)

```ts
/**
 * Operation: sendMessage.
 * Constraints: publish=["onMessage"], request="MessageInput", response="Message".
 * Output type: Message.
 * Input type: MessageInput.
 * @param input - MessageInput request payload.
 * See {@link MessageInput}.
 * @returns Message operation result.
 * See {@link Message}.
 * Publishes events: onMessage.
 * @example
 * await client.sendMessage({ text: "Hello" })
 * @example
 * sendMessage({ text: "Hello" }: MessageInput): Message
 */
sendMessage(input: MessageInput): Promise<Message>;
```

## How to read generated operation JSDoc

Generated operation docs include runtime schema metadata so IDE hovers explain both type shape and delivery behavior.

Example:

```ts
/**
 * Operation: sendMessage.
 * Constraints: publish=["onMessage"], ack={"required":true,"mode":"received","timeoutMs":5000,"retries":3}, request="MessageInput", response="Message".
 * Output type: Message.
 * Input type: MessageInput.
 * @param input - MessageInput request payload.
 * See {@link MessageInput}.
 * @returns Message operation result.
 * See {@link Message}.
 * Publishes events: onMessage.
 */
```

Meaning:

- `Operation: sendMessage`: operation name in the schema.
- `Constraints`: normalized runtime metadata from schema AST.
- `publish=["onMessage"]`: this operation emits the `onMessage` topic.
- `request="MessageInput"`: schema-level request schema name.
- `response="Message"`: schema-level response schema name.
- `Output type: Message`: generated TypeScript return payload type used by client code.
- `Input type: MessageInput`: generated TypeScript input type required by client code.
- `@param` / `@returns` / `See {@link ...}`: hover-friendly links and call schema details for IDE usage.

## Subscription hover format

Generated subscription hover docs use the same deterministic structure:

```ts
/**
 * Subscription callback for "onMessage".
 * Constraints: input="MessageInput", payload="Message", output="Message".
 * Request input: MessageInput.
 * Output type: Message.
 * @param payload - Message payload emitted for "onMessage".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link Message} and {@link ClientHandlerContext}.
 * @example
 * api({ onMessage: (payload) => payload.text });
 */
onMessage?(payload: Message, ctx: ClientHandlerContext): void;
```

### `and(...)` schema composition in generated types

When schemas are composed with `and(...)`, generated client types are emitted as TypeScript intersections.

Example:

```ts
type MessageWithId = MessageInput & WithId;
```

If `and({ left, right, name })` is used, the explicit `name` becomes the generated type surface name.

### `ack` constraints

`ack` defines delivery confirmation behavior for publish flow:

- `required: true`: publish requires acknowledgement.
- `mode: "received"`: acknowledgement is emitted on receive.
- `timeoutMs: 5000`: acknowledgement timeout window.
- `retries: 3`: retry attempts before failure is surfaced.

In generated JSDoc, this appears inside `Constraints` so delivery behavior is visible directly at the call site (`api.sendMessage(...)`).

## Generator and docs sync rule

Generated JSDoc is produced by the client generator (`@livon/client`), so generator output and docs must stay synchronized.

Required when changing generator behavior:

- update generator implementation in `packages/client/src/generate.ts` or templates in `packages/client/templates/*`
- update this page when generated JSDoc structure or terminology changes
- update package docs in [@livon/client](/docs/packages/client) when usage/hover behavior changes
- keep `packages/client/src/generate.spec.ts` aligned with current generated output expectations

Prompt rule source for this package:

- `packages/client/PROMPT.md`
- [Generators](/docs/core/generators)

## IDE impact

- Hover tooltips show summary and example from the schema source.
- Schema docs stay near the schema that defines execution boundaries.
- Frontend and backend teams read the same canonical description.

## Why this matters

Generated JSDoc from schema metadata reduces documentation drift and keeps structural alignment visible in daily development workflows.

## Related concepts

- [Why Livon Exists](why-livon-exists)
- [Backend / Frontend Symmetry](backend-frontend-symmetry)
