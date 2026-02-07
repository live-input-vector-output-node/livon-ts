---
title: How LIVON Differs From Other Tools
sidebar_position: 2
---

LIVON is not only a validator, not only an RPC layer, and not only a transport helper.  
It combines runtime orchestration, [schema contracts](/docs/schema), and generated client APIs in one model.

## High-level comparison

<table className="livon-comparison-table">
  <thead>
    <tr>
      <th>Category</th>
      <th>Typical focus</th>
      <th className="livon-highlight-column">LIVON focus</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>RPC frameworks</td>
      <td>request/response method contracts</td>
      <td className="livon-highlight-column">event envelope flow + operations/subscriptions</td>
    </tr>
    <tr>
      <td>Validation libraries</td>
      <td>data parsing/validation</td>
      <td className="livon-highlight-column">parsing + runtime contract execution + publish flow</td>
    </tr>
    <tr>
      <td>Transport libraries</td>
      <td>network connectivity</td>
      <td className="livon-highlight-column">transport adapters that plug into a shared runtime contract</td>
    </tr>
    <tr>
      <td>State libs</td>
      <td>UI state updates</td>
      <td className="livon-highlight-column">runtime events feeding state systems (<code>zustand</code>, <code>redux</code>)</td>
    </tr>
  </tbody>
</table>

## Core differences

1. **Symmetric runtime model**
   Frontend and backend use the same runtime composition idea (`runtime(moduleA, moduleB, ...)`).

2. **[Schema-first execution](/docs/schema)**
   [Schemas](/docs/schema) define contracts and drive runtime execution, not only static validation.

3. **Module boundaries**
   Transport, [schema execution](/docs/schema), and reliability concerns are separated into modules.

4. **Generated client contract**
   Client API is generated from server [schema AST](/docs/schema), reducing manual contract drift.

5. **Event-driven by default**
   LIVON models request/response and publish behavior through a shared envelope lifecycle.

## Practical implication

You can still use other tools with LIVON.  
LIVON’s role is to provide the event-runtime contract and [schema-driven execution layer](/docs/schema) across those tools.
