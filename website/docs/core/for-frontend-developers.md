---
title: For Frontend Developers
sidebar_position: 5
---

This page explains LIVON in frontend terms: components, state, and predictable data flow.

## What you get with LIVON

<table className="livon-comparison-table">
  <thead>
    <tr>
      <th>Topic</th>
      <th>Typical frontend setup</th>
      <th className="livon-highlight-column">LIVON</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>API calls</td>
      <td>handwritten fetch wrappers and ad-hoc typings</td>
      <td className="livon-highlight-column">generated typed client methods</td>
    </tr>
    <tr>
      <td>Real-time updates</td>
      <td>custom WebSocket event maps in each app</td>
      <td className="livon-highlight-column">one consistent event pattern across apps</td>
    </tr>
    <tr>
      <td>Store integration</td>
      <td>UI-level transport glue in components</td>
      <td className="livon-highlight-column">clean handoff from events to store actions/selectors</td>
    </tr>
    <tr>
      <td>Refactors</td>
      <td>endpoint and payload changes break late</td>
      <td className="livon-highlight-column">compile-time feedback from generated types</td>
    </tr>
    <tr>
      <td>Day-to-day DX</td>
      <td>many small conventions to remember</td>
      <td className="livon-highlight-column">one predictable calling style for operations and subscriptions</td>
    </tr>
  </tbody>
</table>

## How this feels in frontend work

1. You spend less time maintaining duplicate types.
2. State wiring (`zustand`, `redux`) stays simple and repetitive in a good way.
3. Real-time features look similar from project to project.
4. Renaming fields or events is safer because generated types guide you.

## Tradeoffs

1. You follow a shared runtime convention instead of fully custom per-app event plumbing.
2. Contract changes should start in [schema](/docs/schema), then regenerate client types.

## Best fit

Use LIVON when frontend teams ship real-time UI and want fewer integration surprises between UI, state, and backend contracts.
