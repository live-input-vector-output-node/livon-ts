import { vi } from 'vitest';

import type {
  AstNode,
  Schema,
  SchemaBuildContext,
  SchemaContext,
  SchemaDoc,
  SchemaRequestContext,
  SchemaRequestContextInput,
  SchemaState,
  SchemaResult,
} from '../../types.js';
import type {
  SchemaFactoryChainDefinition,
  SchemaWithChain,
} from '../../schemaFactory.js';

export interface BaseSchemaMockOverrides<TValue> extends Partial<Schema<TValue>> {
  name?: string;
  type?: string;
  astNode?: AstNode;
  outputValue?: TValue;
  validateResult?: SchemaResult<TValue>;
}

export interface SchemaStateMockOverrides extends Partial<SchemaState> {}

export const createSchemaStateMock = (
  overrides: SchemaStateMockOverrides = {},
): SchemaState => ({
  get: vi.fn(() => undefined) as SchemaState['get'],
  set: vi.fn(() => undefined) as SchemaState['set'],
  update: vi.fn(() => undefined) as SchemaState['update'],
  snapshot: vi.fn(() => ({})) as SchemaState['snapshot'],
  ...overrides,
});

export interface SchemaContextMockOverrides extends Partial<SchemaContext> {
  buildContext?: SchemaBuildContext;
  requestContext?: SchemaRequestContext;
  state?: SchemaState;
}

export const createSchemaContextMock = (
  overrides: SchemaContextMockOverrides = {},
): SchemaContext => {
  const state = overrides.state ?? createSchemaStateMock();
  const getBuildContext = vi.fn<SchemaContext['getBuildContext']>(
    () => overrides.buildContext,
  );
  const setBuildContext = vi.fn(() => undefined) as SchemaContext['setBuildContext'];
  const getRequestContext = vi.fn<SchemaContext['getRequestContext']>(
    () => overrides.requestContext,
  );
  const setRequestContext = vi.fn(
    (_input?: SchemaRequestContextInput) => undefined,
  ) as SchemaContext['setRequestContext'];

  return {
    getBuildContext,
    setBuildContext,
    getRequestContext,
    setRequestContext,
    get request() {
      return overrides.requestContext;
    },
    state,
    ...overrides,
  };
};

const createDefaultAstNode = (name: string, type: string): AstNode => ({
  name,
  type,
});

export const createBaseSchemaMock = <TValue>(
  overrides: BaseSchemaMockOverrides<TValue> = {},
): Schema<TValue> => {
  const name = overrides.name ?? 'schema.mock';
  const type = overrides.type ?? 'schema.mock';
  const astNode = overrides.astNode ?? createDefaultAstNode(name, type);
  const outputValue = overrides.outputValue as TValue;
  const validateResult =
    overrides.validateResult ?? ({ ok: true, value: outputValue } as SchemaResult<TValue>);

  const schema = {} as Schema<TValue>;

  schema.name = name;
  schema.type = type;
  schema.ast = vi.fn<Schema<TValue>['ast']>(() => astNode);
  schema.validate = vi.fn<Schema<TValue>['validate']>(() => validateResult);
  schema.parse = vi.fn<Schema<TValue>['parse']>(() => outputValue);
  schema.typed = vi.fn<Schema<TValue>['typed']>((input) => input);
  schema.optional = vi.fn(
    () => schema as unknown as Schema<TValue | undefined>,
  ) as Schema<TValue>['optional'];
  schema.nullable = vi.fn(
    () => schema as unknown as Schema<TValue | null>,
  ) as Schema<TValue>['nullable'];
  schema.describe = vi.fn<Schema<TValue>['describe']>(() => schema);
  schema.refine = vi.fn<Schema<TValue>['refine']>(() => schema);
  schema.before = vi.fn<Schema<TValue>['before']>(() => schema);
  schema.after = vi.fn(
    () => schema as unknown as Schema<unknown>,
  ) as Schema<TValue>['after'];
  schema.and = vi.fn(
    () => schema as unknown as Schema<TValue & unknown>,
  ) as Schema<TValue>['and'];

  return {
    ...schema,
    ...overrides,
  };
};

export interface SchemaWithChainMockInput<TValue = unknown> {
  name?: string;
  type?: string;
  chainKeys?: readonly string[];
  overrides?: Partial<SchemaWithChain<TValue, SchemaFactoryChainDefinition<TValue>>>;
}

export const createSchemaWithChainMock = <TValue = unknown>(
  input: SchemaWithChainMockInput<TValue> = {},
): SchemaWithChain<TValue, SchemaFactoryChainDefinition<TValue>> => {
  const schema = createBaseSchemaMock<TValue>({
    name: input.name,
    type: input.type,
  }) as SchemaWithChain<TValue, SchemaFactoryChainDefinition<TValue>>;

  (input.chainKeys ?? []).forEach((chainKey) => {
    (schema as Record<string, unknown>)[chainKey] = vi.fn(() => schema);
  });

  return input.overrides ? Object.assign(schema, input.overrides) : schema;
};

export interface SchemaFactoryMockInput {
  name: string;
  type: string;
  doc?: SchemaDoc;
  ast: (ctx: SchemaContext) => AstNode;
  validate: (input: unknown, ctx: SchemaContext) => unknown;
  chain?: Record<
    string,
    (value: unknown, ctx: SchemaContext) => (...args: readonly unknown[]) => unknown
  >;
}

export type SchemaFactoryMock = ReturnType<
  typeof vi.fn<
    (input: SchemaFactoryMockInput) => SchemaWithChain<
      unknown,
      SchemaFactoryChainDefinition<unknown>
    >
  >
>;

export const createSchemaFactoryMock = (): SchemaFactoryMock =>
  vi.fn<
    (input: SchemaFactoryMockInput) => SchemaWithChain<
      unknown,
      SchemaFactoryChainDefinition<unknown>
    >
  >((factoryInput) =>
    createSchemaWithChainMock<unknown>({
      name: factoryInput.name,
      type: factoryInput.type,
      chainKeys: Object.keys(factoryInput.chain ?? {}),
    }),
  );
