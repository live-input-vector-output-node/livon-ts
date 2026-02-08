---
title: For Backend Developers
sidebar_position: 6
---

This page explains LIVON in backend terms: request boundaries, domain execution, and publish flow.

## What you get with LIVON

<table className="livon-comparison-table">
  <thead>
    <tr>
      <th>Topic</th>
      <th>Typical backend framework flow</th>
      <th className="livon-highlight-column">LIVON</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Handler shape</td>
      <td>controller, validation, and transport details often mixed</td>
      <td className="livon-highlight-column">clear split: transport, <a href="/docs/schema">schema parsing</a>, operation execution</td>
    </tr>
    <tr>
      <td>Input/output contracts</td>
      <td>validation and DTO mapping in multiple places</td>
      <td className="livon-highlight-column"><a href="/docs/schema">schema contract</a> defines parse + output expectations</td>
    </tr>
    <tr>
      <td>Publish events</td>
      <td>ad-hoc pub/sub calls per endpoint</td>
      <td className="livon-highlight-column">operation-level publish mapping with consistent event shape</td>
    </tr>
    <tr>
      <td>Reliability modules</td>
      <td>retries/DLQ often embedded in handlers</td>
      <td className="livon-highlight-column">reliability can be composed as separate runtime modules</td>
    </tr>
    <tr>
      <td>Client alignment</td>
      <td>frontend adapts manually to backend changes</td>
      <td className="livon-highlight-column">generated client follows the same contract source</td>
    </tr>
  </tbody>
</table>

## Backend impact in practice

1. Domain logic is easier to test because transport concerns are pushed outward.
2. Validation and payload shape checks are explicit and centralized.
3. Event outputs are more uniform, which helps logging and debugging.
4. Contract evolution is visible in one place instead of scattered handlers.

## Tradeoffs

1. Some framework shortcuts do not map 1:1 to [schema-first](/docs/schema) flow.
2. Teams need discipline: define contract first, then implement execution.

## Best fit

Use LIVON when backend teams need strict boundaries, predictable event handling, and reusable runtime modules beyond one service.
