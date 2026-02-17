import { createSchemaContext } from './context.js';
import { runFieldOperation, runOperation, type Operation, type FieldOperation } from './operation.js';
import type {
  AckConfig,
  AstNode,
  Logger,
  PublishInput,
  PublishAck,
  SchemaContext,
  SchemaRequestContextInput,
  Schema,
} from './types.js';
import { pack, unpack } from 'msgpackr';
import type { Subscription } from './api.js';

import type {
  EventEnvelope,
  EventError,
  RuntimeContext,
  RuntimeModule,
  RuntimeModuleRegister,
  RuntimeRegistry,
  PartialEventEnvelope,
} from '@livon/runtime';

type RuntimeNext = (update?: PartialEventEnvelope) => Promise<EventEnvelope>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- module registry stores heterogeneous schemas.
type AnySchema = Schema<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime operation registry carries unresolved generic payload/input types.
type AnyInput = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime operation registry carries unresolved generic result types.
type AnyResult = any;

type AnyOperation = Operation<AnySchema, AnySchema | undefined, AnyResult>;
type AnyFieldOperation = FieldOperation<AnySchema, AnyInput, AnySchema | undefined, AnyResult>;
type AnySubscription = Subscription<AnySchema | undefined, AnySchema, AnySchema | undefined, unknown>;

export interface SchemaModuleLike {
  operations: Record<string, AnyOperation>;
  fieldOperations: Record<string, AnyFieldOperation>;
  subscriptions: Record<string, AnySubscription>;
  ast: () => AstNode;
}

export type SchemaModuleInput = SchemaModuleLike;

const normalizeSchemaModuleInput = (input: SchemaModuleLike): SchemaModuleInput => ({
  operations: input.operations,
  fieldOperations: input.fieldOperations,
  subscriptions: input.subscriptions,
  ast: input.ast,
});

export type SchemaModuleOptions = {
  explain?: boolean;
  schemaVersion?: string;
  now?: SchemaModuleNow;
  encoder?: SchemaModuleEncoder;
  decoder?: SchemaModuleDecoder;
  logger?: Logger;
  getRequestContext?: SchemaModuleGetRequestContext;
};

export interface SchemaModuleNow {
  (): number;
}

export interface SchemaModuleEncoder {
  (value: unknown): Uint8Array;
}

export interface SchemaModuleDecoder {
  (payload: Uint8Array | unknown): unknown;
}

export interface SchemaModuleGetRequestContext {
  (envelope: EventEnvelope, ctx: RuntimeContext): SchemaRequestContextInput | undefined;
}

export interface ExplainPayload {
  ast: AstNode;
  checksum: string;
  schemaVersion?: string;
  generatedAt: string;
  etag: string;
  notModified?: boolean;
}

export interface FieldPayload {
  dependsOn: unknown;
  input?: unknown;
}

export interface BuildExplainPayloadInput {
  notModified?: boolean;
  ast: AstNode;
  checksum: string;
  schemaVersion?: string;
  now: () => number;
}

export interface EmitErrorEventInput {
  ctx: RuntimeContext;
  envelope: EventEnvelope;
  metadata?: Readonly<Record<string, unknown>>;
  error: unknown;
  info?: Readonly<Record<string, unknown>>;
}

export type EnvelopeWithMeta = EventEnvelope & {
  meta?: Readonly<Record<string, unknown>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const defaultEncode = (value: unknown): Uint8Array => pack(value);

const defaultDecode = (payload: Uint8Array | unknown): unknown =>
  payload instanceof Uint8Array ? unpack(payload) : payload;

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

const hashString = (input: string): string =>
  Array.from(input).reduce((hash, char) => {
    const next = (hash ^ char.charCodeAt(0)) >>> 0;
    return Math.imul(next, 16777619) >>> 0;
  }, 2166136261).toString(16).padStart(8, '0');

const getEnvelopeMetadata = (envelope: EventEnvelope): Readonly<Record<string, unknown>> | undefined => {
  if (envelope.metadata) {
    return envelope.metadata;
  }
  return (envelope as EnvelopeWithMeta).meta;
};

const normalizeFieldPayload = (payload: unknown): FieldPayload =>
  isRecord(payload) && 'dependsOn' in payload
    ? (payload as unknown as FieldPayload)
    : { dependsOn: payload };

interface FieldEventInfo {
  owner: string;
  field: string;
}

const splitFieldEvent = (event: string): FieldEventInfo | undefined => {
  if (!event.startsWith('$')) {
    return undefined;
  }
  const body = event.slice(1);
  const dotIndex = body.indexOf('.');
  if (dotIndex <= 0 || dotIndex === body.length - 1) {
    return undefined;
  }
  return { owner: body.slice(0, dotIndex), field: body.slice(dotIndex + 1) };
};

const mergeMetadata = (
  base?: Readonly<Record<string, unknown>>,
  extra?: Readonly<Record<string, unknown>>,
) => {
  if (!base && !extra) {
    return undefined;
  }
  return { ...(base ?? {}), ...(extra ?? {}) };
};

const buildExplainPayload = (input: BuildExplainPayloadInput): ExplainPayload => ({
  ast: input.ast,
  checksum: input.checksum,
  schemaVersion: input.schemaVersion,
  generatedAt: new Date(input.now()).toISOString(),
  etag: input.checksum,
  ...(input.notModified ? { notModified: true } : {}),
});

const eventErrorFromUnknown = (error: unknown, info?: Readonly<Record<string, unknown>>): EventError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack,
      context: info,
    };
  }
  return {
    message: typeof error === 'string' ? error : 'Unknown error',
    context: info,
  };
};

const normalizeAckConfig = (ack?: PublishAck): AckConfig | undefined => {
  if (ack === undefined || ack === false) {
    return undefined;
  }
  if (ack === true) {
    return { required: true, mode: 'received' };
  }
  return {
    required: ack.required ?? true,
    mode: ack.mode ?? 'received',
    ...(typeof ack.timeoutMs === 'number' ? { timeoutMs: ack.timeoutMs } : {}),
    ...(typeof ack.retries === 'number' ? { retries: ack.retries } : {}),
  };
};

interface ResolveSubscriptionPayloadInput {
  subscription: AnySubscription;
  input?: unknown;
  payload: unknown;
  ctx: SchemaContext;
}

interface ResolveSubscriptionPayloadResult {
  skip: boolean;
  payload?: unknown;
}

const resolveSubscriptionPayload = async (
  input: ResolveSubscriptionPayloadInput,
): Promise<ResolveSubscriptionPayloadResult> => {
  const parsedInput = input.subscription.input
    ? input.subscription.input.parse(input.input, input.ctx)
    : input.input;
  const parsedPayload = input.subscription.payload.parse(input.payload, input.ctx);
  if (input.subscription.filter) {
    const allowed = await input.subscription.filter(parsedInput, parsedPayload, input.ctx);
    if (!allowed) {
      return { skip: true };
    }
  }
  const executed = input.subscription.exec
    ? await input.subscription.exec(parsedInput, parsedPayload, input.ctx)
    : parsedPayload;
  const output = input.subscription.output
    ? input.subscription.output.parse(executed, input.ctx)
    : executed;
  return { skip: false, payload: output };
};

const emitErrorEvent = async (input: EmitErrorEventInput) =>
  input.ctx.emitError({
    id: input.envelope.id,
    event: input.envelope.event,
    status: input.envelope.status,
    ...(input.envelope.payload !== undefined ? { payload: input.envelope.payload } : {}),
    error: eventErrorFromUnknown(input.error, input.info),
    metadata: input.metadata,
    context: input.envelope.context ? { ...input.envelope.context } : undefined,
  });

/**
 * schemaModule is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/schema
 *
 * @example
 * const result = schemaModule(undefined as never);
 */
export const schemaModule = (schema: SchemaModuleLike, options: SchemaModuleOptions = {}): RuntimeModule => {
  const moduleSchema = normalizeSchemaModuleInput(schema);
  const encode = options.encoder ?? defaultEncode;
  const decode = options.decoder ?? defaultDecode;
  const now = options.now ?? Date.now;

  const ast = moduleSchema.ast();
  const checksum = hashString(stableStringify(ast));

  const onReceive = async (envelope: EventEnvelope, ctx: RuntimeContext, next: RuntimeNext) => {
    if (envelope.event === '$explain') {
      if (!options.explain) {
        return next();
      }
      const metadata = getEnvelopeMetadata(envelope);
      const ifNoneMatch = typeof metadata?.ifNoneMatch === 'string' ? metadata.ifNoneMatch : undefined;
      const notModified = Boolean(ifNoneMatch && ifNoneMatch === checksum);
      const payload = buildExplainPayload({
        notModified,
        ast,
        checksum,
        schemaVersion: options.schemaVersion,
        now,
      });
      await ctx.emitEvent({
        event: envelope.event,
        payload: encode(payload),
        metadata,
        context: envelope.context ? { ...envelope.context } : undefined,
      });
      return envelope;
    }

    const op = moduleSchema.operations[envelope.event];
    const fieldInfo = op ? undefined : splitFieldEvent(envelope.event);
    const fieldKey = fieldInfo ? `${fieldInfo.owner}.${fieldInfo.field}` : undefined;
    const fieldOp = fieldInfo && !op
      ? moduleSchema.fieldOperations[fieldKey!] ?? moduleSchema.fieldOperations[fieldInfo.field]
      : undefined;

    if (!op && !fieldOp) {
      return next();
    }

    const metadata = getEnvelopeMetadata(envelope);
    const requestOverrides = options.getRequestContext ? options.getRequestContext(envelope, ctx) : undefined;
    const externalPublisher = requestOverrides?.publisher;
    const externalOnPublishError = requestOverrides?.onPublishError;
    const schemaContext = createSchemaContext();

    const publisher = async (input: PublishInput) => {
      const subscription = moduleSchema.subscriptions[input.topic];
      if (!subscription) {
        throw new Error(`schemaModule: publish topic "${input.topic}" has no matching subscription.`);
      }
      const resolved = await resolveSubscriptionPayload({
        subscription,
        input: input.input,
        payload: input.payload,
        ctx: schemaContext,
      });
      if (resolved.skip) {
        return;
      }
      const keyMeta = input.key ? { key: input.key } : undefined;
      const ackMeta = normalizeAckConfig(input.ack);
      const ackWrapper = ackMeta ? { ack: ackMeta } : undefined;
      const publishMeta = mergeMetadata(
        metadata,
        mergeMetadata(
          input.meta,
          mergeMetadata(keyMeta, ackWrapper),
        ),
      );
      await ctx.emitEvent({
        event: input.topic,
        payload: encode(resolved.payload),
        metadata: publishMeta,
        context: envelope.context ? { ...envelope.context } : undefined,
      });
      if (externalPublisher) {
        await externalPublisher({
          ...input,
          payload: resolved.payload,
          ...(ackMeta ? { ack: ackMeta } : {}),
        });
      }
    };

    const handlePublishError = (error: unknown, info?: Readonly<Record<string, unknown>>) => {
      if (externalOnPublishError) {
        externalOnPublishError(error, info);
      }
      void emitErrorEvent({ ctx, envelope, metadata, error, info });
    };

    const requestContext: SchemaRequestContextInput = {
      ...requestOverrides,
      metadata: mergeMetadata(metadata, requestOverrides?.metadata),
      publisher,
      onPublishError: handlePublishError,
      logger: requestOverrides?.logger ?? options.logger,
    };

    schemaContext.setRequestContext(requestContext);
    const input = decode(envelope.payload);
    const fieldPayload = op ? undefined : normalizeFieldPayload(input);
    let result: unknown;
    try {
      result = op
        ? await runOperation(op, input, schemaContext)
        : await runFieldOperation(
            fieldOp as AnyFieldOperation,
            fieldPayload?.dependsOn,
            fieldPayload?.input,
            schemaContext,
          );
    } catch (error) {
      await emitErrorEvent({
        ctx,
        envelope,
        metadata,
        error,
        info: { phase: 'execute', event: envelope.event },
      });
      return envelope;
    }

    await ctx.emitEvent({
      event: envelope.event,
      payload: encode(result),
      metadata,
      context: envelope.context ? { ...envelope.context } : undefined,
    });

    return envelope;
  };

  const register: RuntimeModuleRegister = (registry: RuntimeRegistry) => {
    registry.onReceive(onReceive);
  };

  return {
    name: 'schema',
    register,
  };
};
