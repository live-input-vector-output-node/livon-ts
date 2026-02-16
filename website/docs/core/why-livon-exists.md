---
title: Why Livon Exists
sidebar_position: 1
---

LIVON exists to keep one deterministic schema across transport, runtime execution, publish/subscription flow, and generated client APIs.

## Real-world context

In distributed teams, the same schema is often redefined multiple times:

- transport payload assumptions
- backend handler input/output types
- publish event payloads
- frontend subscription payload types
- API documentation snippets

Each redefinition creates another place where drift can start.

## Structural duplication creates drift

<div className="livon-octagon-table">
  <table className="livon-comparison-table">
    <thead>
      <tr>
        <th>Execution boundary</th>
        <th>Typical drift source</th>
        <th className="livon-highlight-column">LIVON</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Transport to runtime</td>
        <td>ad-hoc payload parsing</td>
        <td className="livon-highlight-column">parse with schema at receive step</td>
      </tr>
      <tr>
        <td>Operation input to logic</td>
        <td>handwritten input interfaces</td>
        <td className="livon-highlight-column">operation input schema</td>
      </tr>
      <tr>
        <td>Logic output to transport</td>
        <td>implicit output shape</td>
        <td className="livon-highlight-column">operation output schema</td>
      </tr>
      <tr>
        <td>Publish to subscription</td>
        <td>event payload remapping drift</td>
        <td className="livon-highlight-column">publish map + subscription schema</td>
      </tr>
      <tr>
        <td>Server to client docs</td>
        <td>stale docs and examples</td>
        <td className="livon-highlight-column">generated API + JSDoc from schema</td>
      </tr>
    </tbody>
  </table>
</div>

## Why this matters for engineering managers

- Structural duplication increases coordination cost across teams.
- Boundary failures surface late and consume incident/debug time.
- Schema ownership becomes unclear when each layer has its own shape definition.

LIVON reduces structural duplication by making the schema executable and deterministic at each integration point.

## Why this matters for senior developers

- Validated-by-default execution keeps business logic focused on valid data.
- Schema symmetry keeps backend/frontend composition mentally aligned.
- Generated client APIs and schema-driven docs reduce manual sync work.

## Design decision

LIVON is not positioned as only validation or only transport.
It is a deterministic runtime that treats validation, execution, publish/subscription, and client generation as one aligned system.

## Distinction from gRPC, GraphQL, and Socket.IO

<div className="livon-octagon-table">
  <table className="livon-comparison-table">
    <thead>
      <tr>
        <th>Dimension</th>
        <th>gRPC</th>
        <th>GraphQL</th>
        <th>Socket.IO</th>
        <th className="livon-highlight-column">LIVON</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Primary center</td>
        <td>RPC transport schema</td>
        <td>query and resolver graph</td>
        <td>realtime transport channels</td>
        <td className="livon-highlight-column">deterministic execution model</td>
      </tr>
      <tr>
        <td>Where schema drift starts</td>
        <td>between proto and runtime handler behavior</td>
        <td>between schema, resolver behavior, and event payloads</td>
        <td>between emitted event payloads and handler assumptions</td>
        <td className="livon-highlight-column">one schema drives receive, exec, send, publish, subscribe, and generated client API</td>
      </tr>
      <tr>
        <td>Realtime publish and subscribe alignment</td>
        <td>usually added as separate stream/event modeling</td>
        <td>often resolver-specific and implementation-defined</td>
        <td>event naming is explicit, payload schemas are manual</td>
        <td className="livon-highlight-column">operation publish mapping and subscription payload schema stay structurally aligned</td>
      </tr>
      <tr>
        <td>Generated client developer docs</td>
        <td>depends on toolchain and comments</td>
        <td>depends on schema descriptions and codegen setup</td>
        <td>typically manual for event handlers</td>
        <td className="livon-highlight-column">schema doc metadata flows into generated TypeScript and JSDoc for operations and subscriptions</td>
      </tr>
    </tbody>
  </table>
</div>

gRPC, GraphQL, and Socket.IO can still be used as transport or API layers.
LIVON focuses on keeping one deterministic schema through the full execution lifecycle.

## Related concepts

- [Validated by Default](validated-by-default)
- [Backend / Frontend Symmetry](backend-frontend-symmetry)
- [SchemaDoc & Generated JSDoc](schema-doc-and-generated-jsdoc)
