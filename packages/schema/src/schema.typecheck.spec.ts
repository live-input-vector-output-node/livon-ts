import { describe, expect, it } from 'vitest';

import {
  after,
  and,
  api,
  array,
  before,
  binary,
  boolean,
  composeApi,
  date,
  enumeration,
  fieldOperation,
  literal,
  number,
  object,
  operation,
  or,
  string,
  subscription,
  tuple,
  union,
  type Api,
  type FieldOperation,
  type Infer,
  type Operation,
  type Schema,
  type SchemaLike,
  type Subscription,
} from './index.js';

type Equal<TActual, TExpected> =
  (<T>() => T extends TActual ? 1 : 2) extends
  (<T>() => T extends TExpected ? 1 : 2)
    ? (<T>() => T extends TExpected ? 1 : 2) extends
      (<T>() => T extends TActual ? 1 : 2)
      ? true
      : false
    : false;

type Expect<T extends true> = T;

const stringSchema = string().min(2).max(20).regex(/^[a-z]+$/i) satisfies Schema<string>;
const numberSchema = number().int().positive().min(1).max(99) satisfies Schema<number>;
const booleanSchema = boolean() satisfies Schema<boolean>;
const dateSchema = date() satisfies Schema<Date>;
const binarySchema = binary({ name: 'Payload' }) satisfies Schema<Uint8Array>;
const literalSchema = literal({ name: 'Status', value: 'ready' }) satisfies Schema<'ready'>;
const enumSchema = enumeration('Role').values('admin', 'user').literal('admin') satisfies Schema<'admin' | 'user'>;
const optionalSchema = string().optional() satisfies Schema<string | undefined>;
const nullableSchema = date().nullable() satisfies Schema<Date | null>;
const describedSchema = string().describe('Name') satisfies Schema<string>;
const refinedSchema = number().refine({
  predicate: (value) => value > 0,
  message: 'positive',
}) satisfies Schema<number>;
const beforeSchema = before({
  schema: string(),
  hook: (input) => (typeof input === 'string' ? input.trim() : input),
}) satisfies Schema<string>;
const afterSchema = after({
  schema: string(),
  hook: (value) => value.length,
}) satisfies Schema<number>;

const userSchema = object({
  name: 'User',
  shape: {
    id: string(),
    age: number(),
    active: boolean(),
  },
}) satisfies Schema<{ id: string; age: number; active: boolean }>;

const tagListSchema = array({
  name: 'Tags',
  item: string(),
}) satisfies Schema<string[]>;

const tupleItems = [string(), number()] satisfies readonly [Schema<string>, Schema<number>];
const tupleSchema = tuple({
  name: 'Pair',
  items: tupleItems,
}) satisfies Schema<[string, number]>;

const stringNumberOptions = [string(), number()] satisfies readonly [Schema<string>, Schema<number>];
const orSchema = or({
  options: stringNumberOptions,
}) satisfies Schema<string | number>;

const booleanLiteralOptions = [
  literal({ name: 'Yes', value: true }),
  literal({ name: 'No', value: false }),
] satisfies readonly [Schema<true>, Schema<false>];
const unionSchema = union({
  options: booleanLiteralOptions,
}) satisfies Schema<true | false>;

const intersectionSchemas = [
  object({ name: 'WithId', shape: { id: string() } }),
  object({ name: 'WithAge', shape: { age: number() } }),
] satisfies readonly [Schema<{ id: string }>, Schema<{ age: number }>];
const andSchema = and({
  schemas: intersectionSchemas,
}) satisfies Schema<{ id: string } & { age: number }>;

const reflectedSchemas = [
  stringSchema,
  numberSchema,
  booleanSchema,
  dateSchema,
  binarySchema,
  literalSchema,
  enumSchema,
  optionalSchema,
  nullableSchema,
  describedSchema,
  refinedSchema,
  beforeSchema,
  afterSchema,
  userSchema,
  tagListSchema,
  tupleSchema,
  orSchema,
  unionSchema,
  andSchema,
] satisfies readonly SchemaLike[];

export type StringSchemaReflection = Expect<Equal<Infer<typeof stringSchema>, string>>;
export type NumberSchemaReflection = Expect<Equal<Infer<typeof numberSchema>, number>>;
export type BooleanSchemaReflection = Expect<Equal<Infer<typeof booleanSchema>, boolean>>;
export type DateSchemaReflection = Expect<Equal<Infer<typeof dateSchema>, Date>>;
export type BinarySchemaReflection = Expect<Equal<Infer<typeof binarySchema>, Uint8Array>>;
export type LiteralSchemaReflection = Expect<Equal<Infer<typeof literalSchema>, 'ready'>>;
export type EnumSchemaReflection = Expect<Equal<Infer<typeof enumSchema>, 'admin' | 'user'>>;
export type OptionalSchemaReflection = Expect<Equal<Infer<typeof optionalSchema>, string | undefined>>;
export type NullableSchemaReflection = Expect<Equal<Infer<typeof nullableSchema>, Date | null>>;
export type DescribedSchemaReflection = Expect<Equal<Infer<typeof describedSchema>, string>>;
export type RefinedSchemaReflection = Expect<Equal<Infer<typeof refinedSchema>, number>>;
export type BeforeSchemaReflection = Expect<Equal<Infer<typeof beforeSchema>, string>>;
export type AfterSchemaReflection = Expect<Equal<Infer<typeof afterSchema>, number>>;
export type ObjectSchemaReflection = Expect<
  Equal<Infer<typeof userSchema>, { id: string; age: number; active: boolean }>
>;
export type ArraySchemaReflection = Expect<Equal<Infer<typeof tagListSchema>, string[]>>;
export type TupleSchemaReflection = Expect<Equal<Infer<typeof tupleSchema>, [string, number]>>;
export type OrSchemaReflection = Expect<Equal<Infer<typeof orSchema>, string | number>>;
export type UnionSchemaReflection = Expect<Equal<Infer<typeof unionSchema>, true | false>>;
export type AndSchemaReflection = Expect<Equal<Infer<typeof andSchema>, { id: string } & { age: number }>>;
// @ts-expect-error - string schemas must not reflect number.
export type WrongStringSchemaReflection = Expect<Equal<Infer<typeof stringSchema>, number>>;
// @ts-expect-error - object field reflection must preserve field types.
export type WrongObjectSchemaReflection = Expect<Equal<Infer<typeof explicitObjectSchema>, { id: number }>>;

export const explicitStringSchema: Schema<string> = string();
export const explicitNumberSchema: Schema<number> = number().min(1);
export const explicitObjectSchema: Schema<{ id: string }> = object({
  name: 'UserId',
  shape: { id: string() },
});

const createUserInput = object({
  name: 'CreateUserInput',
  shape: { name: string() },
});
const userOutput = object({
  name: 'UserOutput',
  shape: { id: string(), name: string() },
});
const fieldInput = object({
  name: 'FieldInput',
  shape: { locale: string() },
});
const fieldOutput = object({
  name: 'FieldOutput',
  shape: { value: string() },
});

const createUserOperation = operation({
  input: createUserInput,
  output: userOutput,
  exec: async (input) => ({ id: input.name, name: input.name }),
}) satisfies Operation<typeof createUserInput, typeof userOutput, { id: string; name: string }>;

const displayNameField = fieldOperation({
  dependsOn: userSchema,
  input: fieldInput,
  output: fieldOutput,
  exec: async (dependsOn, input) => ({ value: `${dependsOn.id}:${input.locale}` }),
}) satisfies FieldOperation<typeof userSchema, typeof fieldInput, typeof fieldOutput, { value: string }>;

const userCreatedSubscription = subscription({
  input: fieldInput,
  payload: userOutput,
  output: fieldOutput,
  filter: (input, payload) => input.locale.length > 0 && payload.id.length > 0,
  exec: (input, payload) => ({ value: `${payload.name}:${input.locale}` }),
}) satisfies Subscription<typeof fieldInput, typeof userOutput, typeof fieldOutput, { value: string }>;

const userApi = api({
  type: userSchema,
  operations: {
    createUser: createUserOperation,
  },
  fieldOperations: {
    displayName: displayNameField,
  },
  subscriptions: {
    userCreated: userCreatedSubscription,
  },
}) satisfies Api<
  typeof userSchema,
  { createUser: typeof createUserOperation },
  { displayName: typeof displayNameField }
>;

export type ApiEntityReflection = Expect<Equal<typeof userApi.entity, typeof userSchema | undefined>>;
export type ApiOperationReflection = Expect<
  Equal<typeof userApi.operations.createUser, typeof createUserOperation>
>;
export type ApiFieldReflection = Expect<
  Equal<typeof userApi.fieldOperations.displayName, typeof displayNameField>
>;
export type ApiSubscriptionReflection = Expect<
  Equal<typeof userApi.subscriptions.userCreated, typeof userCreatedSubscription>
>;

const composedApi = composeApi({ user: userApi }) satisfies ReturnType<typeof composeApi<{ user: typeof userApi }>>;

export type ComposedApiOperationReflection = Expect<
  Equal<typeof composedApi.operations.createUser, typeof createUserOperation>
>;

export type OperationInputReflection = Expect<
  Equal<Parameters<typeof createUserOperation.exec>[0], { name: string }>
>;
// @ts-expect-error - operation input reflection must preserve the input schema value type.
export type WrongOperationInputReflection = Expect<Equal<Parameters<typeof createUserOperation.exec>[0], { name: number }>>;

export type FieldDependsOnReflection = Expect<
  Equal<Parameters<typeof displayNameField.exec>[0], { id: string; age: number; active: boolean }>
>;
export type FieldInputReflection = Expect<
  Equal<Parameters<typeof displayNameField.exec>[1], { locale: string }>
>;
// @ts-expect-error - field operation dependsOn reflection must preserve the entity schema value type.
export type WrongFieldDependsOnReflection = Expect<Equal<Parameters<typeof displayNameField.exec>[0], { id: number }>>;

describe('schema type reflection', () => {
  it('is enforced by TypeScript typecheck assertions', () => {
    expect(reflectedSchemas).toHaveLength(19);
    expect(composedApi.type).toBe('api-composed');
  });
});
