---
title: Testing and Quality
sidebar_position: 4
---

For contributors and reviewers, this page defines required test and quality standards across the monorepo.

## Root quality gates

```sh
pnpm qg
```

`qg` runs `check:readmes`, `check:policies`, `lint`, `typecheck`, `test`, and `build`.
The root command uses concise output by default: success stays summary-only, while failures print the failing task logs.

For fast local iteration on changed scope only:

```sh
pnpm qg:changed
```

`qg:changed` runs the same gate graph with Turbo `--affected`.

If you need full logs while debugging, rerun the failing package command directly or invoke the equivalent Turbo command with `--output-logs=full`.

Lint warnings use per-package budgets (no regression policy):

- Budgets: `configs/quality/lint-warning-budgets.json`
- Enforcement: each `eslint` lint script uses `--max-warnings <budget>`
- Verification: `pnpm check:policies`

## Monorepo Vitest workspace

Root tests are executed by Vitest workspace config at `vitest.workspace.ts`.
Each package/app/tool test config is registered as its own Vitest project.

```sh
pnpm test
pnpm run test --config vitest.workspace.ts
```

## Package-local tests

Most packages expose:

```sh
pnpm --filter <package-name> test
pnpm --filter <package-name> test:unit
pnpm --filter <package-name> test:integration
```

### Parameters

- `<package-name>`: workspace package selector (for example [@livon/runtime](/docs/packages/runtime)).

## CI scope

The CI workflow runs one root command and delegates orchestration to Turborepo.
CI caching includes PNPM store and local `.turbo` artifacts.

```sh
pnpm run ci
```

## Security analysis in CI

Security-focused automated checks are executed in dedicated workflows and repository security settings:

- GitHub CodeQL default setup (Code Scanning): static analysis for JavaScript/TypeScript and workflow files.
- `secrets.yml`: Gitleaks secret scanning to detect leaked credentials in git history.
- `snyk.yml`: dependency review gate using GitHub Advisory data (free for public repositories).
- `scorecards.yml`: OpenSSF Scorecard analysis with SARIF upload.

These complement repository gates and help identify vulnerabilities before release.

## Coverage publishing

After CI succeeds on `main`, a separate coverage workflow rebuilds the workspace,
runs the Vitest workspace with coverage enabled, and uploads the resulting
`lcov.info` reports to Coveralls.

```sh
pnpm run build
pnpm exec vitest run --config vitest.workspace.ts --coverage --reporter=dot
```

The public coverage badges on the overview pages point to those hosted reports.

## Coding quality baseline

- Functional style only.
- Immutable updates.
- No loop keywords.
- No classes and no `this`.
- No `any` unless explicitly justified in docs/comments.

## Executable documentation rules

Unit tests are treated as executable documentation.
They must communicate behavior clearly enough that readers understand the implementation schema without opening source files.

### Naming

- Use semantic test names with this pattern: `it('should <do> when <happen>', ...)`.
- Prefer behavior-first phrasing over implementation details where possible.

### Example domain consistency

- When feasible, use the Todo domain as the default use case in tests (`Todo`, `TodoIdentity`, `readTodos`, `updateTodo`, ...).
- Apply this to new tests and when updating existing tests so test language stays aligned with repository docs and examples.

### Default delivery flow

- Use `DX -> TDD -> implementation` as the default sequence.
- Step 1 (`DX`): agree the target API/usage shape before writing tests or implementation.
- Step 2 (`TDD`): encode the full agreed DX as tests first.
- Step 3 (`implementation`): change implementation only until all tests are green.
- After each step, provide a concise summary of current alignment vs agreed DX and explicitly confirm whether to proceed or adjust.

### Structure

- Use one top-level `describe('<api>()')` block per tested source file.
- Inside it, use `describe('happy')` and `describe('sad')` to separate success and failure behavior.
- Use `beforeAll`, `beforeEach`, `afterEach`, and `afterAll` consistently for setup and cleanup.
- Keep per-group test data small and centralized: initialize shared group data in `beforeEach` or reusable test utilities where feasible.
- Before writing new tests, check existing test files for similar setup and behaviors.
- If setup is repeated (for example `entity/source/action/stream` construction), move it into `beforeEach` or reusable helpers in `testing/` utilities.
- If multiple tests validate the same behavior with different input data, consolidate them into one parameterized `it.each` test when feasible.
- Prefer extending existing test utilities over adding near-duplicate setup code in each test file.
- Keep reusable test helpers under `testing/utils/` with one utility per file and a local `testing/utils/index.ts` barrel export.

### Mocking and isolation

- Unit tests should be fully mocked and atomic per behavior.
- Mock every callable dependency with `vi.fn()`.
- Mock [schema](/docs/schema) and [runtime](/docs/packages/runtime) object properties as explicit mock fields when those properties are part of behavior checks.
- Reuse shared mock instances across tests where practical for speed.
- Reset only per-mock state (`mockClear`/`mockReset`) instead of resetting the full Vitest runtime every test.
- Assert call parameters explicitly for every relevant interaction.
- Prefer interface-based mock schemas over `typeof`-based schemas when both are feasible.

### Mock factory pattern

- Keep reusable mock builders under a dedicated `testing/mocks` folder in package source.
- Prefer composable factories where higher-level mocks call lower-level mocks.
- Recommended pattern:

```ts
const createBaseSchemaMock = (overrides?: Partial<SchemaWithChain>) => ({
  parse: vi.fn(),
  typed: vi.fn(),
  optional: vi.fn(),
  nullable: vi.fn(),
  describe: vi.fn(),
  refine: vi.fn(),
  before: vi.fn(),
  after: vi.fn(),
  and: vi.fn(),
  ...overrides,
});

const createStringMock = (override: Partial<StringSchemaMock> = {}) => ({
  ...createBaseSchemaMock(),
  min: vi.fn(),
  max: vi.fn(),
  email: vi.fn(),
  regex: vi.fn(),
  ...override,
});
```

### Branch coverage requirement

- For every changed file, test all reachable branches with explicit happy/sad cases.
- Missing branch tests are considered incomplete implementation work.

See [Governance and Rule Sources](governance) and [Coding Style Guide](coding-style-guide) for the canonical rule set.
