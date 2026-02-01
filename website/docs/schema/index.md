---
title: Schema APIs
sidebar_position: 1
---

[@livon/schema](/docs/packages/schema) exports schema builders and schema combinators.  
This section documents each schema API with a focused usage example.

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

## API contracts

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
  createSchemaModuleInput,
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

const author = string().min(2);
const messageText = string().min(1);
const priority = number().int().min(0);
const isPinned = boolean();
const createdAt = date();
const role = enumeration('Role').values('user', 'moderator', 'admin');

const tags = array({name: 'Tags', item: string()});
const position = tuple({name: 'Position', items: [number(), number()]});
const globalRoom = literal({name: 'GlobalRoom', value: 'global'});
const attachment = binary({name: 'Attachment'});

const textOrAttachment = union({
  name: 'TextOrAttachment',
  options: [messageText, attachment],
});

const roomSelector = or({
  name: 'RoomSelector',
  options: [globalRoom, string()],
});

const normalizedText = before({
  schema: messageText,
  hook: (input) => (typeof input === 'string' ? input.trim() : input),
});

const lowerText = after({
  schema: normalizedText,
  hook: (value) => value.toLowerCase(),
});

const positiveInt = and({
  left: number().int(),
  right: number().positive(),
});

const messageInput = object({
  name: 'MessageInput',
  shape: {
    author,
    text: normalizedText,
    room: roomSelector,
    priority: positiveInt,
    isPinned,
    createdAt,
    role,
    tags,
    position,
  },
});

const message = object({
  name: 'Message',
  shape: {
    author,
    text: lowerText,
    room: roomSelector,
    payload: textOrAttachment,
    priority,
    isPinned,
    createdAt,
    role,
    tags,
    position,
  },
});

const sendMessage = operation({
  input: messageInput,
  output: message,
  exec: async (input) => ({
    ...input,
    payload: input.text,
    text: input.text,
  }),
  publish: {
    onMessage: (output) => output,
  },
});

const onMessage = subscription({
  payload: message,
});

const apiSchema = api({
  operations: {sendMessage},
  subscriptions: {onMessage},
});

export const serverSchema = createSchemaModuleInput(apiSchema);
```

## Parameters

The complete example intentionally stays compact.
Each function parameter used above is documented on its dedicated schema page:

- primitives and collections: [string](string), [number](number), [boolean](boolean), [date](date), [enumeration](enumeration), [object](object), [array](array), [tuple](tuple), [literal](literal), [union](union), [or](or), [binary](binary)
- combinators: [before](before), [after](after), [and](and)
- contracts: [api](api), [operation](operation), [subscription](subscription), [fieldResolver](field-resolver)

## Advanced APIs

- [schemaFactory](schema-factory)
- [typeGuards](type-guards)
