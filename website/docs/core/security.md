---
title: Security and Vulnerability Reporting
sidebar_position: 11
---

This page is the canonical security policy source for LIVON.
The repository `SECURITY.md` file is generated from this page.

## Supported Versions

LIVON uses lockstep versioning across the monorepo.
Security fixes are provided for the latest release line only.

| Version | Supported |
| --- | --- |
| Latest `0.x` release line | yes |
| Older `0.x` release lines | no |
| Unreleased local changes | no |

## Private Vulnerability Reporting

Do not report vulnerabilities in public issues or pull requests.
Use one of these private channels:

- GitHub Security Advisories: https://github.com/live-input-vector-output-node/livon-ts/security/advisories/new
- fallback email: `info@livon.tech` with subject prefix `[SECURITY]`

Please include:

- affected package(s) and version(s),
- impact and exploitability summary,
- reproduction steps or proof of concept,
- suggested mitigations (if known).

## Response Timeline

Maintainer targets:

- acknowledgment within 3 business days,
- initial triage update within 7 business days,
- follow-up status updates at least every 7 business days until resolution.

If accepted, we coordinate a fix and publish an advisory when available.
If declined, we provide a short rationale.

## Coordinated Disclosure

- Keep reports private until a fix is available.
- Coordinated disclosure target is within 90 days when feasible.
- Reporter credit is included unless anonymity is requested.

## Dependency and Supply Chain Notes

- Dependabot is enabled for dependency updates.
- CI includes dependency review, Scorecard, and secret-scanning workflows.
- Root quality gates include policy checks, lint, typecheck, tests, and builds.
