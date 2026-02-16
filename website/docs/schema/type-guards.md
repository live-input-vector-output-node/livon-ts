---
title: "typeGuards"
sidebar_position: 18
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![Package Size](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Flive-input-vector-output-node%2Flivon-ts%2Fmain%2F.github%2Fbadges%2Fsize-schema.json)](https://www.npmjs.com/package/@livon/schema)
[![Security Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![CI](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)


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
