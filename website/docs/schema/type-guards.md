---
title: "typeGuards"
sidebar_position: 18
---

`typeGuards` exposes reusable runtime predicates that help you narrow `unknown` values safely.

```ts
import {typeGuards} from '@livon/schema';

interface MessagePayload {
  author: string;
  text: string;
}

const isMessagePayload = (input: unknown): input is MessagePayload =>
  typeGuards.isRecord(input) &&
  typeGuards.isString(input.author) &&
  typeGuards.isString(input.text);

const parsePayload = (input: unknown): MessagePayload => {
  if (!isMessagePayload(input)) {
    throw new Error('Invalid payload');
  }
  return input;
};
```

## Parameters

`isMessagePayload(input)`:

- `input` (`unknown`): value to narrow.

`parsePayload(input)`:

- `input` (`unknown`): runtime payload checked via type guards before returning typed value.

Available guards:

- `isString`
- `isNumber`
- `isBoolean`
- `isDate`
- `isUint8Array`
- `isRecord`
- `isArray`
