import { AstNode, Infer, SchemaLike, SchemaContext, SchemaDoc, Shape } from './types.js';
import { normalizeDoc } from './doc.js';
import {
  FieldOperation,
  Operation,
  OperationExecutor,
  OperationPublishMap,
  OperationRooms,
} from './operation.js';

type AnySchema = SchemaLike;
type AnyResult = unknown;
type AnyOperation = Omit<Operation<AnySchema, AnySchema | undefined, AnyResult>, 'exec' | 'publish' | 'rooms'> & {
  exec: OperationExecutor<never, AnyResult>;
  publish?: OperationPublishMap<never>;
  rooms?: OperationRooms<never>;
};
type AnyFieldOperation = Omit<
  FieldOperation<AnySchema, AnySchema | Shape | undefined, AnySchema | undefined, AnyResult>,
  'exec'
> & {
  exec: unknown;
};
type AnySubscription = Subscription<AnySchema | undefined, AnySchema, AnySchema | undefined, unknown>;
type InputInfer<TInputSchema extends AnySchema | undefined> = TInputSchema extends AnySchema ? Infer<TInputSchema> : undefined;
type ValueOf<T> = T[keyof T];

export interface SubscriptionFilter<TInput, TPayload> {
  (input: TInput, payload: TPayload, ctx: SchemaContext): boolean | Promise<boolean>;
}

export interface SubscriptionExecutor<TInput, TPayload, TResult> {
  (input: TInput, payload: TPayload, ctx: SchemaContext): TResult | Promise<TResult>;
}

export interface ApiShape {
  [key: string]: AnyOperation;
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

type SubscriptionFromInput<TInput> =
  TInput extends Subscription<infer TInputSchema, infer TPayloadSchema, infer TOutputSchema, infer TResult>
    ? Subscription<TInputSchema, TPayloadSchema, TOutputSchema, TResult>
    : TInput extends SubscriptionInput<infer TInputSchema, infer TPayloadSchema, infer TOutputSchema, infer TResult>
      ? Subscription<TInputSchema, TPayloadSchema, TOutputSchema, TResult>
      : TInput extends AnySchema
        ? Subscription<undefined, TInput, undefined, unknown>
        : never;

export type SubscriptionShapeFromInput<TInput extends SubscriptionInputShape> = {
  [K in keyof TInput]: SubscriptionFromInput<TInput[K]>;
};

/**
 * subscription is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/api
 *
 * @example
 * const result = subscription({ payload: UserCreated });
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
  TSubscriptionShape extends SubscriptionShape = SubscriptionShape,
> {
  type: 'api';
  entity?: TType;
  operations: TShape;
  fieldOperations: TFieldShape;
  subscriptions: TSubscriptionShape;
  ast: ApiAst;
}

export type ApiInput<
  TType extends AnySchema | undefined,
  TShape extends ApiShape,
  TFieldShape extends ApiFieldShape,
  TSubscriptionInputShape extends SubscriptionInputShape = SubscriptionInputShape,
> = {
  type?: TType;
  operations?: TShape;
  fieldOperations?: TFieldShape;
  subscriptions?: TSubscriptionInputShape;
  doc?: SchemaDoc;
} & Partial<TShape>;

const isSchema = (value: unknown): value is AnySchema =>
  typeof value === 'object' && value !== null && 'parse' in value && 'ast' in value;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOperation = (value: unknown): value is Operation<AnySchema, AnySchema | undefined, unknown> =>
  isRecord(value) && value.type === 'operation';

interface SubscriptionInputRecord extends Record<string, unknown> {
  doc?: SchemaDoc;
  exec?: AnySubscription['exec'];
  filter?: AnySubscription['filter'];
  input?: unknown;
  name?: string;
  output?: unknown;
  payload: AnySchema;
}

const isSubscriptionInputRecord = (value: unknown): value is SubscriptionInputRecord =>
  isRecord(value) && 'payload' in value && isSchema(value.payload);

const subscriptionFilterFromInput = (value: SubscriptionInputRecord): AnySubscription['filter'] | undefined =>
  typeof value.filter === 'function' ? value.filter : undefined;

const subscriptionExecFromInput = (value: SubscriptionInputRecord): AnySubscription['exec'] | undefined =>
  typeof value.exec === 'function' ? value.exec : undefined;

const mergeOperations = (input: object, explicit?: ApiShape): ApiShape => {
  const ops: ApiShape = { ...(explicit ?? {}) };
  Object.entries(input).forEach(([key, value]) => {
    if (!ops[key] && isOperation(value)) {
      ops[key] = value;
    }
  });
  return ops;
};

const mergeFieldOperations = (input?: ApiFieldShape): ApiFieldShape => ({ ...(input ?? {}) });

const nameOperation = (name: string, op: AnyOperation): AnyOperation =>
  op.name ? op : { ...op, name };

const nameFieldOperation = (name: string, op: AnyFieldOperation): AnyFieldOperation =>
  op.name ? op : { ...op, name };

const subscriptionFromInput = (name: string, value: unknown): AnySubscription | undefined => {
  if (isSubscriptionInputRecord(value)) {
    const payload = value.payload;
    const input = isSchema(value.input) ? value.input : undefined;
    const output = isSchema(value.output) ? value.output : undefined;
    const filter = subscriptionFilterFromInput(value);
    const exec = subscriptionExecFromInput(value);
    const doc = value.doc;
    const normalized = value.name;
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
 * @see https://livon.tech/docs/schema/api
 *
 * @example
 * const result = api({ operations: { createUser } });
 */
export function api<
  TType extends AnySchema | undefined,
  TShape extends ApiShape,
  TFieldShape extends ApiFieldShape,
  TSubscriptionInputShape extends SubscriptionInputShape = SubscriptionInputShape,
>(
  input: ApiInput<TType, TShape, TFieldShape, TSubscriptionInputShape>,
): Api<TType, TShape, TFieldShape, SubscriptionShapeFromInput<TSubscriptionInputShape>>;
export function api(
  input: ApiInput<AnySchema | undefined, ApiShape, ApiFieldShape, SubscriptionInputShape>,
): Api<AnySchema | undefined, ApiShape, ApiFieldShape, SubscriptionShape> {
  const { type, operations, fieldOperations, subscriptions, doc, ...rest } = input;
  const mergedOperations = mergeOperations(rest, operations);
  const mergedFieldOperations = mergeFieldOperations(fieldOperations);
  const mergedSubscriptions = mergeSubscriptions(subscriptions);

  if (Object.keys(mergedFieldOperations).length > 0 && !type) {
    throw new Error('api.type is required when fieldOperations are provided.');
  }

  const namedOperations = Object.entries(mergedOperations).reduce<ApiShape>((acc, [key, op]) => {
    acc[key] = nameOperation(key, op);
    return acc;
  }, {});

  const namedFieldOperations = Object.entries(mergedFieldOperations).reduce<ApiFieldShape>((acc, [key, op]) => {
    acc[key] = nameFieldOperation(key, op);
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

  const apiDoc = normalizeDoc(doc);

  return {
    type: 'api',
    entity: type,
    operations: namedOperations,
    fieldOperations: namedFieldOperations,
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
}

export interface ComposedApi<
  TApis extends Record<string, Api<AnySchema | undefined, ApiShape, ApiFieldShape, SubscriptionShape>>,
> {
  type: 'api-composed';
  apis: TApis;
  operations: ValueOf<{ [K in keyof TApis]: TApis[K]['operations'] }>;
  fieldOperations: ApiFieldShape;
  subscriptions: ValueOf<{ [K in keyof TApis]: TApis[K]['subscriptions'] }>;
  ast: ApiAst;
}

/**
 * composeApi is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/api
 *
 * @example
 * const result = composeApi({ users: usersApi });
 */
export const composeApi = <
  TApis extends Record<string, Api<AnySchema | undefined, ApiShape, ApiFieldShape, SubscriptionShape>>,
>(
  apis: TApis,
): ComposedApi<TApis> => {
  const operations = Object.assign(
    {},
    ...Object.values(apis).map((apiInstance) => apiInstance.operations),
  );
  const fieldOperations: ApiFieldShape = {};
  const subscriptions = Object.assign(
    {},
    ...Object.values(apis).map((apiInstance) => apiInstance.subscriptions),
  );
  const operationNames = new Set<string>();
  const subscriptionNames = new Set<string>();

  Object.values(apis).forEach((apiInstance) => {
    Object.keys(apiInstance.operations).forEach((name) => {
      if (operationNames.has(name)) {
        throw new Error(`composeApi: duplicate operation name \"${name}\"`);
      }
      operationNames.add(name);
    });

    Object.entries(apiInstance.fieldOperations).forEach(([name, op]) => {
      const owner = apiInstance.entity?.name;
      const key = owner ? `${owner}.${name}` : name;
      if (fieldOperations[key]) {
        throw new Error(`composeApi: duplicate field operation name \"${key}\"`);
      }
      fieldOperations[key] = op;
    });

    Object.keys(apiInstance.subscriptions ?? {}).forEach((name) => {
      if (subscriptionNames.has(name)) {
        throw new Error(`composeApi: duplicate subscription name "${name}"`);
      }
      subscriptionNames.add(name);
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
  } satisfies ComposedApi<TApis>;
};
