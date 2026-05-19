<!-- Generated from website/docs/packages/*.md. Do not edit directly. -->

# @livon/cli


[![npm](https://img.shields.io/npm/v/%40livon%2Fcli)](https://www.npmjs.com/package/@livon/cli)
[![CI](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/ci.yml?branch=main&label=ci)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![Vulnerability scan](https://img.shields.io/github/check-runs/live-input-vector-output-node/livon-ts/main?nameFilter=vulnerability_scan&label=vulnerability%20scan)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/live-input-vector-output-node/livon-ts/badge)](https://scorecard.dev/viewer/?uri=github.com/live-input-vector-output-node/livon-ts)
[![OpenSSF Best Practices](https://www.bestpractices.dev/projects/12249/badge)](https://www.bestpractices.dev/projects/12249)
[![REUSE status](https://api.reuse.software/badge/github.com/live-input-vector-output-node/livon-ts)](https://api.reuse.software/info/github.com/live-input-vector-output-node/livon-ts)
[![license](https://img.shields.io/npm/l/%40livon%2Fcli)](https://www.npmjs.com/package/@livon/cli)

## Purpose

`@livon/cli` is now a compatibility stub.

Livon client generation through CLI has been removed. Configure a Livon build plugin instead.

## Migration

Use one of the plugin packages:

- [`@livon/plugin`](https://livon.tech/docs/packages/plugin) for Vite, Rollup, Webpack, and Rspack.
- [`@livon/plugin-rsbuild`](https://livon.tech/docs/packages/plugin-rsbuild) for Rsbuild and Rslib.

Generated client files are synchronized from the configured Livon WebSocket `$explain` endpoint.
The client repository does not need access to the server repository.
