---
title: Schema APIs
sidebar_position: 1
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema)
[![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml)
[![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)


[@livon/schema](/docs/packages/schema) exports schema builders and schema combinators.  
This section documents each schema API with a focused usage example.
Use it as the reference when implementing or reviewing schema definitions.

## Foundations

- [Schema Type Safety](type-safety)
- [Schema Context](context)

## Primitive schemas

- [string](string)
- [number](number)
- [boolean](boolean)
- [date](date)
- [enumeration](enumeration)

## Collection schemas

- [object](object)
- [array](array)
- [tuple](tuple)
- [literal](literal)
- [union](union)
- [or](or)
- [binary](binary)

## Combinators

- [before](before)
- [after](after)
- [and](and)

## API schemas

- [api](api)
- [operation](operation)
- [subscription](subscription)
- [fieldResolver](field-resolver)

## Complete example (all schema APIs)

```ts
import {
  after,
  and,
  api,
  array,
  before,
  binary,
  boolean,
  date,
  enumeration,
  literal,
  number,
  object,
  operation,
  or,
  string,
  subscription,
  tuple,
  union,
} from '@livon/schema';

const Author = string().min(2);
const MessageText = string().min(1);
const Priority = number().int().min(0);
const IsPinned = boolean();
const CreatedAt = date();
const Role = enumeration('Role').values('user', 'moderator', 'admin');

const Tags = array({name: 'Tags', item: string()});
const Position = tuple({name: 'Position', items: [number(), number()]});
const GlobalRoom = literal({name: 'GlobalRoom', value: 'global'});
const Attachment = binary({name: 'Attachment'});

const TextOrAttachment = union({
  name: 'TextOrAttachment',
  options: [MessageText, Attachment],
});

const RoomSelector = or({
  name: 'RoomSelector',
  options: [GlobalRoom, string()],
});

const NormalizedText = before({
  schema: MessageText,
  hook: (input) => (typeof input === 'string' ? input.trim() : input),
});

const LowerText = after({
  schema: NormalizedText,
  hook: (value) => value.toLowerCase(),
});

const MessageInput = object({
  name: 'MessageInput',
  shape: {
    author: Author,
    text: NormalizedText,
    payload: TextOrAttachment,
    room: RoomSelector,
    priority: Priority,
    isPinned: IsPinned,
    createdAt: CreatedAt,
    role: Role,
    tags: Tags,
    position: Position,
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
  name: 'MessageWithId',
});

const sendMessage = operation({
  input: MessageInput,
  output: MessageWithId,
  exec: async (input) => ({
    ...input,
    text: LowerText.parse(input.text),
    payload: input.text,
    id: 'msg-1',
  }),
  publish: {
    onMessage: (output) => output,
  },
});

const OnMessage = subscription({
  payload: MessageWithId,
});

const ApiSchema = api({
  operations: {sendMessage},
  subscriptions: {onMessage: OnMessage},
});

export const serverSchema = ApiSchema;
```

## Parameters

The complete example intentionally stays compact.
Each function parameter used above is documented on its dedicated schema page:

- primitives and collections: [string](string), [number](number), [boolean](boolean), [date](date), [enumeration](enumeration), [object](object), [array](array), [tuple](tuple), [literal](literal), [union](union), [or](or), [binary](binary)
- combinators: [before](before), [after](after), [and](and)
- schemas: [api](api), [operation](operation), [subscription](subscription), [fieldResolver](field-resolver)

## Advanced APIs

- [schemaFactory](schema-factory)
- [typeGuards](type-guards)
