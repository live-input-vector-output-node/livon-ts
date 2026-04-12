---
title: "typeGuards"
sidebar_position: 18
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/vulnerability-scan.yml?branch=main&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/vulnerability-scan.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)

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
