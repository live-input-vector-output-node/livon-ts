# @livon/sync

## 0.29.0-rc.7

### Patch Changes

- Add source run-context `set(...)` with value and updater forms (`set(nextValue)` and `set((previous) => nextValue)`) for hard-replace state updates.

## 0.29.0-rc.6

### Patch Changes

- Prepare 0.29.0-rc.6 release line.

## 0.29.0-rc.5

### Patch Changes

- Improve sync hot paths by stabilizing scheduler/cache allocation patterns and reducing timer churn via centralized plan scheduling.

## 0.29.0-rc.4

### Patch Changes

- Add `source.reset()` for restoring unit state to its initial value/status/meta/context and add `reset()` to source run context.

## 0.29.0-rc.3

### Patch Changes

- Improve `entityMode` many-read performance by using an adaptive subview strategy:
  small memberships keep the direct fast path, while large memberships reuse stable references when entity entries are unchanged.

## 0.29.0-rc.1

## 0.28.0-rc.4

### Patch Changes

- Add external coverage publishing for Codecov and Coveralls, centralize `lcov`
  generation in the Vitest base config, and tighten the badge layout and docs
  presentation around the new reporting flow.

## 0.28.0-rc.3

## 0.28.0-rc.2

### Patch Changes

- Reformat package badge overview into a structured table and keep the order version, dependencies, code quality, package size, license.

## 0.28.0-rc.1

### Patch Changes

- Standardize package badges across docs and generated package READMEs, including `@livon/sync` and `@livon/react`, while keeping shared CI status global to the overview pages.

## 0.28.0-rc.0

### Minor Changes

- Advance the unstable feature line to `0.28.0-rc.0` with `@livon/sync`, `@livon/react`, and rc-ready release tooling.

## 0.27.0-rc.5

- Initial package scaffold.
