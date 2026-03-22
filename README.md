# LIVON

<p align="center">
  <a href="https://livon.tech">
    <img src="./assets/logo.svg" alt="LIVON Logo" width="520" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml">
    <img src="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml/badge.svg" alt="CI" />
  </a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml">
    <img src="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml/badge.svg" alt="Publish" />
  </a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/docs-pages.yml">
    <img src="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/docs-pages.yml/badge.svg" alt="Docs" />
  </a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/ci.yml">
    <img src="https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality" alt="Code Quality" />
  </a>
  <a href="https://github.com/live-input-vector-output-node/livon-ts">
    <img src="https://img.shields.io/github/license/live-input-vector-output-node/livon-ts" alt="License" />
  </a>
</p>

LIVON (Live Input Vector Output Node) is a TypeScript framework for building APIs that frontend and backend teams can share, including real-time communication.

## Package Badges

| Package | version | dependencies | code quality | package size | license |
| --- | --- | --- | --- | --- | --- |
| `@livon/runtime` | [![npm](https://img.shields.io/npm/v/%40livon%2Fruntime)](https://www.npmjs.com/package/@livon/runtime) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fruntime?label=dependencies)](https://libraries.io/npm/%40livon%2Fruntime) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fruntime?label=package%20size)](https://www.npmjs.com/package/@livon/runtime) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/schema` | [![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fschema?label=dependencies)](https://libraries.io/npm/%40livon%2Fschema) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fschema?label=package%20size)](https://www.npmjs.com/package/@livon/schema) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/client` | [![npm](https://img.shields.io/npm/v/%40livon%2Fclient)](https://www.npmjs.com/package/@livon/client) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fclient?label=dependencies)](https://libraries.io/npm/%40livon%2Fclient) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fclient?label=package%20size)](https://www.npmjs.com/package/@livon/client) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/client-ws-transport` | [![npm](https://img.shields.io/npm/v/%40livon%2Fclient-ws-transport)](https://www.npmjs.com/package/@livon/client-ws-transport) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fclient-ws-transport?label=dependencies)](https://libraries.io/npm/%40livon%2Fclient-ws-transport) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fclient-ws-transport?label=package%20size)](https://www.npmjs.com/package/@livon/client-ws-transport) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/node-ws-transport` | [![npm](https://img.shields.io/npm/v/%40livon%2Fnode-ws-transport)](https://www.npmjs.com/package/@livon/node-ws-transport) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fnode-ws-transport?label=dependencies)](https://libraries.io/npm/%40livon%2Fnode-ws-transport) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fnode-ws-transport?label=package%20size)](https://www.npmjs.com/package/@livon/node-ws-transport) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/dlq-module` | [![npm](https://img.shields.io/npm/v/%40livon%2Fdlq-module)](https://www.npmjs.com/package/@livon/dlq-module) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fdlq-module?label=dependencies)](https://libraries.io/npm/%40livon%2Fdlq-module) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fdlq-module?label=package%20size)](https://www.npmjs.com/package/@livon/dlq-module) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/config` | [![npm](https://img.shields.io/npm/v/%40livon%2Fconfig)](https://www.npmjs.com/package/@livon/config) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fconfig?label=dependencies)](https://libraries.io/npm/%40livon%2Fconfig) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fconfig?label=package%20size)](https://www.npmjs.com/package/@livon/config) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/cli` | [![npm](https://img.shields.io/npm/v/%40livon%2Fcli)](https://www.npmjs.com/package/@livon/cli) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fcli?label=dependencies)](https://libraries.io/npm/%40livon%2Fcli) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fcli?label=package%20size)](https://www.npmjs.com/package/@livon/cli) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/sync` | [![npm](https://img.shields.io/npm/v/%40livon%2Fsync)](https://www.npmjs.com/package/@livon/sync) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Fsync?label=dependencies)](https://libraries.io/npm/%40livon%2Fsync) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Fsync?label=package%20size)](https://www.npmjs.com/package/@livon/sync) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |
| `@livon/react` | [![npm](https://img.shields.io/npm/v/%40livon%2Freact)](https://www.npmjs.com/package/@livon/react) | [![dependencies](https://img.shields.io/librariesio/release/npm/%40livon%2Freact?label=dependencies)](https://libraries.io/npm/%40livon%2Freact) | [![code quality](https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/code-quality.yml?branch=main&label=code%20quality)](https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/code-quality.yml) | [![package size](https://img.shields.io/npm/unpacked-size/%40livon%2Freact?label=package%20size)](https://www.npmjs.com/package/@livon/react) | [![license](https://img.shields.io/github/license/live-input-vector-output-node/livon-ts)](https://github.com/live-input-vector-output-node/livon-ts) |

## What Is LIVON?

LIVON helps you build APIs once and use them on both backend and frontend.
You define your API schema in one place, and LIVON keeps client and server in sync.
It is designed for both request/response flows and real-time event streams.

## Why LIVON?

- One shared API schema for server and client
- Real-time events and API calls in one consistent model
- Fewer integration bugs between frontend and backend
- Strong TypeScript support out of the box
- Works for backend, frontend, and fullstack teams

## How Is LIVON Different from Other Tools?

Many tools solve only one part (validation, transport, or API calls).
LIVON combines these pieces so your team can move faster with less glue code.

## Quick Links (GitHub Pages)

- Documentation Home: https://livon.tech/docs
- Why Livon Exists: https://livon.tech/docs/core/why-livon-exists
- How LIVON Differs From Other Tools: https://livon.tech/docs/core/why-livon-exists#how-livon-differs-from-other-tools
- For Engineering Managers: https://livon.tech/docs/core/for-managers
- For Frontend Developers: https://livon.tech/docs/core/for-frontend-developers
- For Backend Developers: https://livon.tech/docs/core/for-backend-developers
- For Fullstack Developers: https://livon.tech/docs/core/for-fullstack-developers
- Getting Started: https://livon.tech/docs/core/getting-started
- Runtime Design: https://livon.tech/docs/technical/runtime-design
- Schema APIs: https://livon.tech/docs/schema
- Packages Overview: https://livon.tech/docs/packages
- Contributing: https://livon.tech/docs/core/contributing
