---
title: "@livon/client-sync"
sidebar_position: 5
---

[![npm](https://img.shields.io/npm/v/%40livon%2Fclient-sync)](https://www.npmjs.com/package/@livon/client-sync)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/check-runs/live-input-vector-output-node/livon-ts/main?nameFilter=vulnerability_scan&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fclient-sync)](https://www.npmjs.com/package/@livon/client-sync)

## Purpose

`@livon/client-sync` is the bundler-independent sync engine used by Livon build plugins.
It replaces CLI client generation.

Sync flow:

```txt
Livon WebSocket $explain AST endpoint -> @livon/client-sync -> physical generated files
```

## Behavior

The sync engine:

- normalizes the configured WebSocket URL,
- fetches `$explain` AST and checksum metadata,
- compares remote checksum with local `meta.json`,
- writes `client.ts`, `client.d.ts`, `manifest.json`, and `meta.json`,
- uses cache according to the configured failure mode.

## Failure Modes

- `error`: fail immediately.
- `warnAndUseCache`: warn and use existing generated cache; fail if no cache exists.
- `useCache`: use existing generated cache with minimal warning; fail only if no cache exists.

## Security

Generated files and manifests are public artifacts.
They must contain only public contract metadata and stable remote identifiers.
