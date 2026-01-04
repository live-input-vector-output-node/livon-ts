import { AstNode, Infer, Schema, SchemaContext, SchemaDoc } from './types.js';
import { normalizeDoc } from './doc.js';
import { FieldOperation, Operation, withFieldOperationName, withOperationName } from './operation.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- schema generic must stay permissive for covariance/contravariance across composed APIs.
type AnySchema = Schema<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- field input contract accepts shape/schema variants and is normalized at runtime.
type AnyFieldOperation = FieldOperation<AnySchema, any, AnySchema | undefined, unknown>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- operation results are heterogeneous across API shape entries.
type AnyResult = any;
type AnySubscription = Subscription<AnySchema | undefined, AnySchema, AnySchema | undefined, unknown>;
type InputInfer<TInputSchema extends AnySchema | undefined> = TInputSchema extends AnySchema ? Infer<TInputSchema> : undefined;

export interface SubscriptionFilter<TInput, TPayload> {
  (input: TInput, payload: TPayload, ctx: SchemaContext): boolean | Promise<boolean>;
}

export interface SubscriptionExecutor<TInput, TPayload, TResult> {
  (input: TInput, payload: TPayload, ctx: SchemaContext): TResult | Promise<TResult>;
}

export interface ApiShape {
  [key: string]: Operation<AnySchema, AnySchema | undefined, AnyResult>;
}

export interface ApiFieldShape {
  [key: string]: AnyFieldOperation;
}

export interface Subscription<
  TInputSchema extends AnySchema | undefined,
  TPayloadSchema extends AnySchema,
  TOutputSchema extends AnySchema | undefined,
  TResult,
> {
  type: 'subscription';
  input?: TInputSchema;
  output?: TOutputSchema;
  payload: TPayloadSchema;
  filter?: SubscriptionFilter<InputInfer<TInputSchema>, Infer<TPayloadSchema>>;
  exec?: SubscriptionExecutor<InputInfer<TInputSchema>, Infer<TPayloadSchema>, TResult>;
  name?: string;
  doc?: SchemaDoc;
}

export interface SubscriptionShape {
  [key: string]: AnySubscription;
}

export interface SubscriptionInput<
  TInputSchema extends AnySchema | undefined = AnySchema | undefined,
  TPayloadSchema extends AnySchema = AnySchema,
  TOutputSchema extends AnySchema | undefined = AnySchema | undefined,
  TResult = unknown,
> {
  input?: TInputSchema;
  payload: TPayloadSchema;
  output?: TOutputSchema;
  filter?: SubscriptionFilter<InputInfer<TInputSchema>, Infer<TPayloadSchema>>;
  exec?: SubscriptionExecutor<InputInfer<TInputSchema>, Infer<TPayloadSchema>, TResult>;
  name?: string;
  doc?: SchemaDoc;
}

export interface SubscriptionInputShape {
  [key: string]: AnySubscription | SubscriptionInput | AnySchema;
}

/**
 * subscription is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/api
 *
 * @example
 * const result = subscription(undefined as never);
 */
export const subscription = <
  TInputSchema extends AnySchema | undefined = AnySchema | undefined,
  TPayloadSchema extends AnySchema = AnySchema,
  TOutputSchema extends AnySchema | undefined = AnySchema | undefined,
  TResult = unknown,
>(
  input: SubscriptionInput<TInputSchema, TPayloadSchema, TOutputSchema, TResult>,
): Subscription<TInputSchema, TPayloadSchema, TOutputSchema, TResult> => ({
  type: 'subscription',
  payload: input.payload,
  ...(input.input ? { input: input.input } : {}),
  ...(input.output ? { output: input.output } : {}),
  ...(input.filter ? { filter: input.filter } : {}),
  ...(input.exec ? { exec: input.exec } : {}),
  ...(input.name ? { name: input.name } : {}),
  ...(input.doc ? { doc: input.doc } : {}),
});

export interface ApiAst {
  (): AstNode;
}

export interface Api<
  TType extends AnySchema | undefined,
  TShape extends ApiShape,
  TFieldShape extends ApiFieldShape,
> {
  type: 'api';
  entity?: TType;
  operations: TShape;
  fieldOperations: TFieldShape;
  subscriptions: SubscriptionShape;
  ast: ApiAst;
}

export type ApiInput<
  TType extends AnySchema | undefined,
  TShape extends ApiShape,
  TFieldShape extends ApiFieldShape,
> = {
  type?: TType;
  operations?: TShape;
  fieldOperations?: TFieldShape;
  subscriptions?: SubscriptionInputShape;
  doc?: SchemaDoc;
} & Partial<TShape>;

const isOperation = (value: unknown): value is Operation<AnySchema, AnySchema | undefined, unknown> =>
  typeof value === 'object' && value !== null && 'type' in value && (value as { type?: string }).type === 'operation';

const isSchema = (value: unknown): value is AnySchema =>
  typeof value === 'object' && value !== null && 'parse' in value && 'ast' in value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const mergeOperations = (input: Record<string, unknown>, explicit?: ApiShape): ApiShape => {
  const ops: ApiShape = { ...(explicit ?? {}) };
  Object.entries(input).forEach(([key, value]) => {
    if (!ops[key] && isOperation(value)) {
      ops[key] = value;
    }
  });
  return ops;
};

const mergeFieldOperations = (input?: ApiFieldShape): ApiFieldShape => ({ ...(input ?? {}) });

const subscriptionFromInput = (name: string, value: unknown): AnySubscription | undefined => {
  if (isRecord(value) && 'payload' in value && isSchema((value as { payload?: unknown }).payload)) {
    const payload = (value as { payload: AnySchema }).payload;
    const input = isSchema((value as { input?: unknown }).input) ? (value as { input: AnySchema }).input : undefined;
    const output = isSchema((value as { output?: unknown }).output)
      ? (value as { output: AnySchema }).output
      : undefined;
    const filter = typeof (value as { filter?: unknown }).filter === 'function'
      ? ((value as { filter: AnySubscription['filter'] }).filter)
      : undefined;
    const exec = typeof (value as { exec?: unknown }).exec === 'function'
      ? ((value as { exec: AnySubscription['exec'] }).exec)
      : undefined;
    const doc = (value as { doc?: SchemaDoc }).doc;
    const normalized = (value as { name?: string }).name;
    return {
      type: 'subscription',
      payload,
      ...(input ? { input } : {}),
      ...(output ? { output } : {}),
      ...(filter ? { filter } : {}),
      ...(exec ? { exec } : {}),
      ...(doc ? { doc } : {}),
      ...(normalized ? { name: normalized } : {}),
    };
  }
  if (isSchema(value)) {
    return { type: 'subscription', payload: value, name };
  }
  return undefined;
};

const mergeSubscriptions = (input?: SubscriptionInputShape): SubscriptionShape => {
  const subs: SubscriptionShape = {};
  if (!input) {
    return subs;
  }
  Object.entries(input).forEach(([key, value]) => {
    const subscription = subscriptionFromInput(key, value);
    if (subscription) {
      subs[key] = subscription;
    }
  });
  return subs;
};

/**
 * api is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/api
 *
 * @example
 * const result = api(undefined as never);
 */
export const api = <
  TType extends AnySchema | undefined,
  TShape extends ApiShape,
  TFieldShape extends ApiFieldShape,
>(
  input: ApiInput<TType, TShape, TFieldShape>,
): Api<TType, TShape, TFieldShape> => {
  const { type, operations, fieldOperations, subscriptions, ...rest } = input as ApiInput<
    TType,
    ApiShape,
    ApiFieldShape
  > & Record<string, unknown>;

  const mergedOperations = mergeOperations(rest, operations);
  const mergedFieldOperations = mergeFieldOperations(fieldOperations);
  const mergedSubscriptions = mergeSubscriptions(subscriptions);

  if (Object.keys(mergedFieldOperations).length > 0 && !type) {
    throw new Error('api.type is required when fieldOperations are provided.');
  }

  const namedOperations = Object.entries(mergedOperations).reduce<ApiShape>((acc, [key, op]) => {
    acc[key] = op.name ? op : withOperationName({ name: key, operation: op });
    return acc;
  }, {});

  const namedFieldOperations = Object.entries(mergedFieldOperations).reduce<ApiFieldShape>((acc, [key, op]) => {
    acc[key] = op.name ? op : withFieldOperationName({ name: key, operation: op });
    return acc;
  }, {});

  const namedSubscriptions = Object.entries(mergedSubscriptions).reduce<SubscriptionShape>((acc, [key, sub]) => {
    acc[key] = sub.name ? sub : { ...sub, name: key };
    return acc;
  }, {});

  Object.entries(namedOperations).forEach(([operationName, op]) => {
    const topics = Object.keys(op.publish ?? {});
    topics.forEach((topic) => {
      if (!namedSubscriptions[topic]) {
        throw new Error(
          `api: operation "${operationName}" publishes "${topic}" but no subscription with that name exists.`,
        );
      }
    });
  });

  const apiDoc = normalizeDoc(input.doc);

  return {
    type: 'api',
    entity: type,
    operations: namedOperations as TShape,
    fieldOperations: namedFieldOperations as TFieldShape,
    subscriptions: namedSubscriptions,
    ast: () => ({
      type: 'api',
      name: type?.name,
      doc: apiDoc,
      children: [
        ...Object.entries(namedOperations).map(([name, op]) => {
          const publishTopics = Object.keys(op.publish ?? {});
          const requestType = op.input?.name ?? undefined;
          const responseType = op.output?.name ?? undefined;
          const ackConfig = op.ack;
          const constraints = {
            ...(publishTopics.length > 0 ? { publish: publishTopics } : {}),
            ...(ackConfig !== undefined ? { ack: ackConfig } : {}),
            ...(requestType ? { request: requestType } : {}),
            ...(responseType ? { response: responseType } : {}),
          };
          return {
            type: 'operation',
            name,
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
            doc: normalizeDoc(op.doc),
            request: requestType,
            response: responseType,
            children: [op.input.ast(), ...(op.output ? [op.output.ast()] : [])],
          };
        }),
        ...Object.entries(namedSubscriptions).map(([name, sub]) => {
          const inputType = sub.input?.name ?? undefined;
          const payloadType = sub.payload?.name ?? undefined;
          const outputType = sub.output?.name ?? payloadType;
          const constraints = {
            ...(inputType ? { input: inputType } : {}),
            ...(payloadType ? { payload: payloadType } : {}),
            ...(outputType ? { output: outputType } : {}),
          };
          return {
            type: 'subscription',
            name,
            constraints: Object.keys(constraints).length > 0 ? constraints : undefined,
            doc: normalizeDoc(sub.doc),
            request: inputType,
            response: outputType,
            children: [
              sub.payload.ast(),
              ...(sub.input ? [sub.input.ast()] : []),
              ...(sub.output ? [sub.output.ast()] : []),
            ],
          };
        }),
        ...Object.entries(namedFieldOperations).map(([fieldName, op]) => {
          const requestType = op.input?.name ?? undefined;
          const responseType = op.output?.name ?? undefined;
          const dependsOnType = op.dependsOn?.name ?? undefined;
          const constraints = {
            owner: type?.name,
            field: fieldName,
            ...(requestType ? { request: requestType } : {}),
            ...(responseType ? { response: responseType } : {}),
            ...(dependsOnType ? { dependsOn: dependsOnType } : {}),
          };
          return {
            type: 'field',
            name: type?.name ? `${type.name}.${fieldName}` : fieldName,
            constraints,
            doc: normalizeDoc(op.doc),
            request: requestType,
            response: responseType,
            dependsOn: dependsOnType,
            children: [
              op.dependsOn.ast(),
              ...(op.input ? [op.input.ast()] : []),
              ...(op.output ? [op.output.ast()] : []),
            ],
          };
        }),
      ],
    }),
  };
};

export interface ComposedApi<
  TApis extends Record<string, Api<AnySchema | undefined, ApiShape, ApiFieldShape>>,
> {
  type: 'api-composed';
  apis: TApis;
  operations: ApiShape;
  fieldOperations: ApiFieldShape;
  subscriptions: SubscriptionShape;
  ast: ApiAst;
}

/**
 * composeApi is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/api
 *
 * @example
 * const result = composeApi(undefined as never);
 */
export const composeApi = <
  TApis extends Record<string, Api<AnySchema | undefined, ApiShape, ApiFieldShape>>,
>(
  apis: TApis,
): ComposedApi<TApis> => {
  const operations: ApiShape = {};
  const fieldOperations: ApiFieldShape = {};
  const subscriptions: SubscriptionShape = {};

  Object.values(apis).forEach((apiInstance) => {
    Object.entries(apiInstance.operations).forEach(([name, op]) => {
      if (operations[name]) {
        throw new Error(`composeApi: duplicate operation name \"${name}\"`);
      }
      operations[name] = op;
    });

    Object.entries(apiInstance.fieldOperations).forEach(([name, op]) => {
      const owner = apiInstance.entity?.name;
      const key = owner ? `${owner}.${name}` : name;
      if (fieldOperations[key]) {
        throw new Error(`composeApi: duplicate field operation name \"${key}\"`);
      }
      fieldOperations[key] = op;
    });

    Object.entries(apiInstance.subscriptions ?? {}).forEach(([name, sub]) => {
      if (subscriptions[name]) {
        throw new Error(`composeApi: duplicate subscription name "${name}"`);
      }
      subscriptions[name] = sub;
    });
  });

  return {
    type: 'api-composed',
    apis,
    operations,
    fieldOperations,
    subscriptions,
    ast: () => ({
      type: 'api-composed',
      children: Object.entries(apis).map(([name, apiInstance]) => {
        const node = apiInstance.ast();
        return { ...node, name };
      }),
    }),
  };
};
