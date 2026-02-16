---
title: How Livon Differs
sidebar_position: 7
---

LIVON is a deterministic runtime focused on cross-layer alignment, not just one layer of the stack.

## Comparison

<table className="livon-comparison-table">
  <thead>
    <tr>
      <th>Dimension</th>
      <th>Validation-only tools</th>
      <th>Transport/RPC-only tools</th>
      <th className="livon-highlight-column">LIVON</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Runtime boundary validation</td>
      <td>input parsing only</td>
      <td>often delegated to user land</td>
      <td className="livon-highlight-column">validated-by-default across receive, execute, send, publish, and subscribe</td>
    </tr>
    <tr>
      <td>Schema drives execution</td>
      <td>partial</td>
      <td>usually no</td>
      <td className="livon-highlight-column">yes, schema drives execution behavior</td>
    </tr>
    <tr>
      <td>Publish/subscribe model</td>
      <td>optional custom layer</td>
      <td>transport events without schema coupling</td>
      <td className="livon-highlight-column">first-class operation-to-subscription mapping</td>
    </tr>
    <tr>
      <td>Generated IDE documentation</td>
      <td>usually manual</td>
      <td>usually manual</td>
      <td className="livon-highlight-column">schema doc metadata to generated JSDoc</td>
    </tr>
    <tr>
      <td>Deterministic execution envelope</td>
      <td>not central</td>
      <td>transport-centric</td>
      <td className="livon-highlight-column">shared deterministic envelope model across modules</td>
    </tr>
  </tbody>
</table>

## Positioning summary

LIVON should be evaluated as a schema-driven interface workflow:

- a single schema source
- deterministic boundary enforcement
- interface symmetry between backend and frontend

## Practical implication

This model reduces structural duplication and keeps behavior explicit where systems integrate.

## Role-specific impact

For detailed role examples and tradeoffs:

- [For Frontend Developers](for-frontend-developers)
- [For Backend Developers](for-backend-developers)
- [For Fullstack Developers](for-fullstack-developers)
- [For Engineering Managers](for-managers)

## Related concepts

- [Why Livon Exists](why-livon-exists)
- [When Not to Use Livon](when-not-to-use-livon)
