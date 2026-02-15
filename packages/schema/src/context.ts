import {
  AstBuilder,
  AstNode,
  SchemaBuildContext,
  SchemaBuildContextInput,
  SchemaRequestContext,
  SchemaRequestContextInput,
  SchemaState,
  SchemaContext,
} from './types.js';

export interface StateSnapshotRecord {
  [key: string]: unknown;
}

export interface StateUpdater<T> {
  (current: T | undefined): T;
}

export interface CreateBuilder {
  (): AstBuilder;
}

export interface CreateState {
  (): SchemaState;
}

/**
 * createBuilder is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = createBuilder(undefined as never);
 */
export const createBuilder: CreateBuilder = () => {
  const nodes: AstNode[] = [];
  return {
    add: (node) => {
      nodes.push(node);
      return node;
    },
    getAll: () => nodes,
  };
};

/**
 * createState is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = createState(undefined as never);
 */
export const createState: CreateState = () => {
  const store = new Map<string, unknown>();
  return {
    get: <T = unknown>(key: string) => store.get(key) as T | undefined,
    set: (key, value) => {
      store.set(key, value);
    },
    update: <T = unknown>(key: string, updater: StateUpdater<T>) => {
      const next = updater(store.get(key) as T | undefined);
      store.set(key, next);
    },
    snapshot: () =>
      Array.from(store.entries()).reduce<StateSnapshotRecord>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {}),
  };
};

export interface NormalizeBuildContext {
  (input?: SchemaBuildContextInput): SchemaBuildContext;
}

/**
 * normalizeBuildContext is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = normalizeBuildContext(undefined as never);
 */
export const normalizeBuildContext: NormalizeBuildContext = (input = {}) => ({
  buildId: input.buildId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
  builder: input.builder ?? createBuilder(),
  parentNode: input.parentNode,
  schemaPath: input.schemaPath ?? [],
  buildOptions: input.buildOptions ?? {},
});

export interface IsNormalizedRequest {
  (input: SchemaRequestContextInput): input is SchemaRequestContext;
}

/**
 * isNormalizedRequest is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = isNormalizedRequest(undefined as never);
 */
export const isNormalizedRequest = (
  input: SchemaRequestContextInput,
): input is SchemaRequestContext => (input as SchemaRequestContext).normalized === true;

export interface NormalizeRequestContext {
  (input?: SchemaRequestContextInput): SchemaRequestContext;
}

/**
 * normalizeRequestContext is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = normalizeRequestContext(undefined as never);
 */
export const normalizeRequestContext: NormalizeRequestContext = (input = {}) => {
  if (isNormalizedRequest(input)) {
    return input;
  }

  return {
    normalized: true,
    requestId: input.requestId ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    timestamp: input.timestamp ?? Date.now(),
    correlationId: input.correlationId,
    sourceId: input.sourceId,
    userId: input.userId,
    tenantId: input.tenantId,
    metadata: input.metadata,
    state: createState(),
    publisher: input.publisher,
    onPublishError: input.onPublishError,
    logger: input.logger,
  };
};

export interface CreateSchemaContextInput {
  build?: SchemaBuildContextInput;
  request?: SchemaRequestContextInput;
}

export interface CreateSchemaContext {
  (input?: CreateSchemaContextInput): SchemaContext;
}

/**
 * createSchemaContext is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/context
 *
 * @example
 * const result = createSchemaContext(undefined as never);
 */
export const createSchemaContext: CreateSchemaContext = (input = {}) => {
  let buildContext = input.build ? normalizeBuildContext(input.build) : undefined;
  let requestContext = input.request ? normalizeRequestContext(input.request) : undefined;
  const state = requestContext?.state ?? createState();

  return {
    getBuildContext: () => buildContext,
    setBuildContext: (next) => {
      buildContext = next;
    },
    getRequestContext: () => requestContext,
    get request() {
      return requestContext;
    },
    setRequestContext: (next) => {
      requestContext = next ? normalizeRequestContext(next) : undefined;
      if (requestContext && requestContext.state !== state) {
        requestContext = { ...requestContext, state };
      }
    },
    state,
  };
};
