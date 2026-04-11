<!-- Generated from website/docs/core/openssf-best-practices.md. Do not edit directly. -->

# OpenSSF Best Practices (Passing)


This page tracks repository evidence for the OpenSSF Best Practices `Passing` level.

Project page:

- https://www.bestpractices.dev/projects/12249/passing

Snapshot date for this checklist: `2026-04-12`.

## Implemented Repository Evidence

- project website and documentation: https://livon.tech/docs
- public source repository: https://github.com/live-input-vector-output-node/livon-ts
- contribution workflow and quality gates: [Contributing](https://livon.tech/docs/core/contributing)
- support channels and issue/discussion process: [Support and Feedback](https://livon.tech/docs/core/support)
- code-of-conduct policy: [Code of Conduct](https://livon.tech/docs/core/code-of-conduct)
- vulnerability reporting process: [Security and Vulnerability Reporting](https://livon.tech/docs/core/security)
- release notes policy and entries: [Release Notes](https://livon.tech/docs/core/release-notes)
- CI and tests: `.github/workflows/ci.yml`, [Testing and Quality](https://livon.tech/docs/core/testing-and-quality)
- static analysis: `.github/workflows/codeql.yml`
- dependency/security scanning: `.github/workflows/snyk.yml`, `.github/workflows/scorecards.yml`
- build and release workflow: `.github/workflows/publish.yml`

## Criteria Mapping Notes

The repository now provides canonical docs and generated root files for:

- `CONTRIBUTING.md`
- `CODE_OF_CONDUCT.md`
- `SUPPORT.md`
- `GOVERNANCE.md`
- `SECURITY.md`
- `.github/SECURITY.md`
- `CHANGELOG.md`

These files are generated from `website/docs/core/*.md` via:

- `pnpm run gen:readmes`
- `pnpm run check:readmes`

Mapping config:

- `configs/docs/readme-sync.json`

Generator implementation:

- `tools/readmes/src/lib.ts`

## Remaining Badge-App Actions (Manual)

The Best Practices page still includes criteria that require manual status updates and/or rationale input in BadgeApp.
Use this repository evidence when updating those entries:

1. set criteria with clear repository evidence to `Met`,
2. add direct URL references to docs/workflows/files for each criterion,
3. add rationale comments for `SUGGESTED` criteria that are intentionally not applicable.

Typical examples that still need manual BadgeApp updates:

- maintainer/security knowledge attestation criteria,
- response-time historical criteria,
- cryptography-specific criteria that depend on deployment context,
- dynamic-analysis criteria where applicability varies by package/runtime.
