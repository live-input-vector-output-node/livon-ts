# Security Policy

## Supported Versions

LIVON uses lockstep versioning across the repository.
Security fixes are provided for the latest release line only.

| Version | Supported          |
| ------- | ------------------ |
| Latest `0.x` release line | :white_check_mark: |
| Older `0.x` release lines | :x:                |
| Unreleased local changes  | :x:                |

## Reporting a Vulnerability

Please do not open public GitHub issues for security vulnerabilities.

Use one of the private channels below:

- Preferred: GitHub Private Vulnerability Reporting (Security Advisories)
  - https://github.com/live-input-vector-output-node/livon-ts/security/advisories/new
- Fallback: email `info@livon.tech`
  - Subject: `[SECURITY] <short summary>`

Please include:

- affected package(s) and version(s)
- impact summary (what an attacker can do)
- clear reproduction steps or proof of concept
- environment details (Node version, OS, runtime setup)
- any suggested mitigation

## Dependency Updates

We use Dependabot for automated dependency update pull requests.
These pull requests are part of our regular maintenance and remediation workflow.

If you discover a new vulnerability, please use the private reporting channels above.
Do not disclose vulnerabilities in public issues or pull requests.

## Response Process

- Acknowledgement: within 3 business days
- Initial triage update: within 7 business days
- Ongoing status updates: at least every 7 business days until resolution

If the report is accepted:

- we will work on a fix and coordinate a release
- we may request additional validation from the reporter
- we will publish a security advisory when the fix is available

If the report is declined, we will provide a short rationale.

## Coordinated Disclosure

- Please keep reports private until a fix is released.
- We target coordinated disclosure within 90 days when feasible.
- Credit is provided in the advisory unless you prefer to stay anonymous.

## Scope Notes

In scope:

- vulnerabilities in maintained LIVON packages and documented runtime behavior

Typically out of scope:

- social engineering or phishing scenarios
- vulnerabilities that require already-compromised local machines
- issues in unsupported/older versions
- third-party vulnerabilities without a LIVON-specific exploit path
