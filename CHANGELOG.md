<!-- Generated from website/docs/core/release-notes.md. Do not edit directly. -->

# Release Notes


This page is the canonical release-notes source for LIVON.
The repository `CHANGELOG.md` file is generated from this page.

## Versioning

LIVON uses a lockstep monorepo version for root, apps, packages, tools, and website.
Versioning follows SemVer, including prerelease identifiers (for example `-rc.1`).

Release version identifiers are unique and tracked in source control history.

## Release Channels

- prerelease: `0.x.y-rc.n`
- stable: `0.x.y`

## Release Notes Policy

Each release notes entry includes:

- a human-readable summary of major changes,
- compatibility impact notes (if any),
- vulnerability fix disclosure notes for publicly known CVEs (if any).

If a release has no known public CVE fixes, the entry states `No known public CVE fixes in this release.`

## Current Entries

### 0.29.0-rc.11 (prerelease)

Highlights:

- schema documentation now uses `field-operation` naming consistently,
- workspace tooling packages were consolidated under `tools/*`,
- CI/security gates were tightened with pinned action SHAs and Snyk enforcement.

Security notes:

- No known public CVE fixes in this release.

### 0.29.0-rc.1 to 0.29.0-rc.10 (prerelease series)

Highlights:

- package docs and generated README alignment improvements,
- policy gate hardening and workspace consistency checks,
- runtime and sync quality/performance improvements.

Security notes:

- vulnerability remediations were applied through dependency updates and overrides where required.

## Artifact Links

- Changesets source: https://github.com/live-input-vector-output-node/livon-ts/tree/main/.changeset
- Root release workflow: https://github.com/live-input-vector-output-node/livon-ts/blob/main/.github/workflows/publish.yml
- Package changelogs:
  - https://github.com/live-input-vector-output-node/livon-ts/tree/main/packages
