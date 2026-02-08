---
title: For Fullstack Developers
sidebar_position: 7
---

This page explains LIVON for teams that own UI + server together and want one end-to-end workflow.

## What you get with LIVON

<table className="livon-comparison-table">
  <thead>
    <tr>
      <th>Topic</th>
      <th>Typical fullstack workflow</th>
      <th className="livon-highlight-column">LIVON</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Feature changes</td>
      <td>update backend endpoint, frontend types, and docs separately</td>
      <td className="livon-highlight-column">update <a href="/docs/schema">schema</a> once and regenerate client</td>
    </tr>
    <tr>
      <td>Real-time work</td>
      <td>custom socket wiring per feature</td>
      <td className="livon-highlight-column">same runtime pattern on both sides</td>
    </tr>
    <tr>
      <td>Team language</td>
      <td>frontend/backend reviews use different abstractions</td>
      <td className="livon-highlight-column">one shared contract and event vocabulary</td>
    </tr>
    <tr>
      <td>Bug class</td>
      <td>shape mismatches discovered late</td>
      <td className="livon-highlight-column">contract mismatch found earlier by types + <a href="/docs/schema">schema</a> checks</td>
    </tr>
    <tr>
      <td>Reuse</td>
      <td>duplicated glue across apps</td>
      <td className="livon-highlight-column">reusable modules and stable runtime composition</td>
    </tr>
  </tbody>
</table>

## Fullstack impact in daily delivery

1. You can ship feature slices faster from contract change to working UI/server.
2. Real-time features become routine instead of one-off implementations.
3. Code reviews are clearer because both sides reference the same contract.
4. Migration between projects is easier because runtime patterns stay consistent.

## Tradeoffs

1. Requires [schema-first](/docs/schema) discipline before implementation.
2. You trade some ad-hoc flexibility for consistency and predictability.

## Best fit

Use LIVON when one team owns end-to-end feature delivery and wants fewer frontend/backend integration loops.
