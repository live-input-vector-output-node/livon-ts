---
title: Backend / Frontend Symmetry
sidebar_position: 5
---

LIVON keeps backend and frontend composition symmetric so teams can reason with one schema model.

## Backend composition

```ts
import {and, api, object, operation, string, subscription} from '@livon/schema';

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    author: string(),
    text: string(),
  },
});

const WithId = object({
  name: 'WithId',
  shape: {
    id: string(),
  },
});

const Message = and({
  left: MessageInput,
  right: WithId,
  name: 'Message',
});

const sendMessage = operation({
  input: MessageInput,
  output: Message,
  exec: async (input) => ({...input, id: 'msg-1'}),
  publish: {
    onMessage: (output) => output,
  },
});

export const ChatApi = api({
  operations: {sendMessage},
  subscriptions: {onMessage: subscription({payload: Message})},
});
```

## Frontend composition

```ts
import {api} from './generated/api';

api({
  onMessage: (payload) => {
    payload.text;
  },
});

await api.sendMessage({author: 'alice', text: 'hello'});
```

### Parameters in these examples

`publish.onMessage`:

- `output` (`Infer<typeof Message>`): validated operation output mapped to subscription payload.

`api({ onMessage })`:

- `onMessage` (`(payload) => void`): generated callback with payload type derived from server schema.

`api.sendMessage(input)`:

- `input` (`MessageInput`): generated operation input type derived from server schema.

## Publish to subscription type propagation

The same event name and schema define both sides:

1. backend `publish.onMessage` emits payload from validated output.
2. frontend `api({ onMessage })` receives the same payload schema.

This is interface symmetry: one deterministic schema source with mirrored execution behavior.

## Cognitive impact

- Lower context switching between backend and frontend.
- Fewer translation layers between API and event handling.
- Structural alignment stays visible in code review and debugging.

## Related concepts

- [Validated by Default](validated-by-default)
- [SchemaDoc & Generated JSDoc](schema-doc-and-generated-jsdoc)
