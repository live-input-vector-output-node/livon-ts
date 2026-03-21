---
name: test-quality-specialist
description: Define and enforce test contracts, reusable test setup patterns, and quality gate coverage before final council decisions.
---

# Test Quality Specialist

## Use when

- Tasks add or change contracts, test suites, mocking patterns, or quality-gate expectations.
- The team needs deterministic guidance for test setup reuse and branch-complete coverage.

## Steps

1. Validate that tests read as executable documentation for behavior and failure paths.
2. Enforce setup deduplication: extract repeated `entity/source/action/stream` setup into `beforeEach` blocks or shared testing utilities.
3. Validate branch coverage and gate requirements for changed scope.
4. Emit concrete test gaps and required checks before final decision.
