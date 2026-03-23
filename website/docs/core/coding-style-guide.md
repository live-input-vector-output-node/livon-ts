---
title: Coding Style Guide
sidebar_position: 7
---

This guide defines the shared coding style across LIVON repositories.
Use it to keep implementation style consistent across packages and apps.

## Core principles

1. Functional and deterministic code.
2. Immutable-by-default updates.
3. ES6-first syntax.
4. [Schema-first validation and typing](/docs/schema).
5. Clear naming where function name and parameter names describe one coherent intent.

## Example domain consistency

- Use the Todo domain as the default use case in repository examples (`Todo`, `TodoScope`, `readTodos`, `updateTodo`, ...).
- Apply this rule to new examples and when updating existing examples, so documentation converges to one consistent domain language over time.

## Language and syntax

- Use English for identifiers, comments, docs, and public APIs.
- Prefer TypeScript over JavaScript when technically feasible.
- Use lambda-first style (arrow functions only).
- Do not use classes or `this`.
- Avoid loop keywords (`for`, `while`) when declarative methods are practical.

```ts
const activeUsers = users.filter((user) => user.active);
const names = activeUsers.map((user) => user.name);
```

## Loop policy

- Default: no `for`/`while` loops.
- Preferred: `map`, `filter`, `reduce`, `find`, `forEach`.
- Allowed exception: small async flow functions where iterator-driven control is required.

```ts
const collectMessages = async (stream: AsyncIterable<string>): Promise<string[]> => {
  const values: string[] = [];
  for await (const value of stream) {
    values.push(value);
  }
  return values;
};
```

## Immutability and object updates

- Never mutate shared inputs or shared state.
- Merge and override objects with spread.

```ts
const nextUser = {...user, age: 3};
```

- If fields must be excluded, destructure first.

```ts
const {password: _unwantedPassword, ...safeUser} = user;
const response = {...safeUser, role: 'member'};
```

## Function design

- Functions should be small and do one thing.
- Prefer max two parameters for new code.
- If inputs are simple primitives, always group them into one semantic config object.
- When a function accepts a config object, destructure it in the parameter list.
- When defaults exist, set them with ES6 parameter defaults in the same destructuring step.
- Keep destructured names identical to config property names to avoid rename churn and `config.*` access.
- Keep existing public callback signatures where external interfaces require them.

```ts
interface RequestUserInput {
  userId: string;
  includePosts: boolean;
}

const requestUser = ({includePosts, userId}: RequestUserInput) =>
  apiRequest({includePosts, userId});
```

```ts
interface EntityRecord {
  id: string;
}

interface CreateEntityInput {
  idOf: (input: EntityRecord) => string;
  ttl?: number;
}

const createEntity = ({idOf, ttl = 0}: CreateEntityInput) => {
  return {idOf, ttl};
};
```

Avoid primitive multi-arg signatures:

```ts
// avoid
const requestUser = (userId: string, includePosts: boolean) =>
  apiRequest({userId, includePosts});
```

## Function typing rules

- No inline object types for function parameters.
- No inline function type signatures for reusable function interfaces.
- Define function interfaces as named `interface` types.
- For overloads, use callable `interface` signatures plus `const` arrow assignments (do not use `function` overload declarations).

```ts
interface BuildDisplayNameInput {
  firstName: string;
  lastName: string;
}

interface BuildDisplayName {
  (input: BuildDisplayNameInput): string;
}

const buildDisplayName: BuildDisplayName = ({firstName, lastName}) =>
  `${firstName} ${lastName}`;
```

## Parameter and property ordering

Order fields by complexity:

1. primitive
2. array
3. object
4. function

```ts
interface ModuleInput {
  name: string;
  tags: readonly string[];
  metadata: Readonly<Record<string, unknown>>;
  onError: (error: unknown) => void;
}
```

## Types and validation

- Avoid `any`. If unavoidable, document why.
- Do not use TypeScript `as` assertions in repository code.
- Shape APIs and helpers so assertions are unnecessary (generics, overloads, discriminated unions, type guards).
- Use `interface` for object shapes.
- Do not use manual `parseX...` or `toX...` validation helpers.
- Use [schema composition](/docs/schema) and `schema.parse`.
- Use `PascalCase` for schema constants in examples and docs (`User`, `MessageInput`, `ApiSchema`).
- Keep operation/resolver runtime functions in `camelCase` (`sendMessage`, `userGreetingResolver`).

```ts
const CreateUserInput = object({
  name: 'CreateUserInput',
  shape: {
    name: string(),
    age: number(),
  },
});

const value = CreateUserInput.parse(input);
```

## ES6-first patterns

```ts
const statusLabel = isReady ? 'ready' : 'waiting';
const sorted = [...values].sort((left, right) => left - right);
const moduleName = input.name ?? 'runtime-module';
```

## File organization

- Keep reusable helpers in scoped `utils/` folders.
- Keep one utility per file and re-export through a local `utils/index.ts` barrel.
- Split core functionality into focused files instead of growing large multi-purpose files.
- Expose module boundaries explicitly through package `exports` in `package.json` plus stable `index.ts` barrel exports.
- Prefer this structure for better testability, mockability, and dependency injection.

## Core vs framework placement

- For every change in a framework package (`react`, `angular`, `svelte`, ...), decide first whether the logic is framework-agnostic.
- Put framework-agnostic runtime/state/sync behavior in core packages (`@livon/sync`), not in framework adapters.
- Keep framework packages focused on integration concerns only (hooks, lifecycle bindings, rendering adapters, platform APIs).
- If a framework change requires duplicating generic logic, move that logic into core and consume it from the adapter package.

## Package responsibility boundaries

- For every implementation change, decide the owning layer first (`runtime`, `schema`, `transport`, `client`, `sync`, framework adapters).
- Do not implement runtime orchestration concerns in transport/client/framework packages.
- Do not implement schema validation/execution concerns in runtime/transport/framework packages.
- Do not implement transport wire concerns in runtime/schema/client/core state packages.
- Keep cross-layer coupling minimal and explicit through package boundaries instead of side-loading responsibilities into a convenient module.
