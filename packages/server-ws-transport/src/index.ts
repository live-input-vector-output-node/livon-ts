/**
 * Public package entrypoint for `@livon/node-ws-transport`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/node-ws-transport
 */
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import type { RawData, WebSocketServer } from 'ws';
import { pack, unpack } from 'msgpackr';

import type {
  EventEnvelope,
  EventEnvelopePayload,
  EventError,
  EventStatus,
  EmitInput,
  RuntimeEventContext,
  RuntimeModule,
  RuntimeRegistry,
} from '@livon/runtime';

declare module '@livon/runtime' {
  interface RuntimeEventContext {
    transport?: string;
    clientId?: string;
  }
}

export type WebSocketData = RawData | ArrayBufferView;

export interface NodeWsTransportOptions {
  server: WebSocketServer;
  encode?: WireEncode;
  decode?: WireDecode;
  onError?: NodeWsTransportOnError;
  getClientContext?: NodeWsTransportClientContext;
  onClientClose?: NodeWsTransportOnClientClose;
}

export interface NodeWsTransportOnError {
  (error: unknown, info: NodeWsTransportErrorInfo): void;
}

export interface NodeWsTransportErrorInfo {
  stage: NodeWsTransportErrorStage;
  clientId?: string;
}

export type NodeWsTransportErrorStage = 'decode' | 'encode' | 'send' | 'receive' | 'connection';

export interface NodeWsTransportClientCloseInfo {
  clientId: string;
  socket: WebSocket;
  request?: IncomingMessage;
  emitSend: RuntimeRegistry['emitSend'];
}

export interface NodeWsTransportOnClientClose {
  (info: NodeWsTransportClientCloseInfo): void | Promise<void>;
}

export interface NodeWsTransportClientInfo {
  clientId: string;
  socket: WebSocket;
  request?: IncomingMessage;
}

export interface NodeWsTransportClientContext {
  (info: NodeWsTransportClientInfo): Record<string, unknown> | undefined;
}

export interface WireEventBase {
  id: string;
  event: string;
  status: EventStatus;
  metadata?: Readonly<Record<string, unknown>>;
  context?: Uint8Array;
}

export interface WireEventPayload extends WireEventBase {
  payload: Uint8Array;
  error?: never;
}

export interface WireEventError extends WireEventBase {
  error: Uint8Array;
  payload?: never;
}

export type WireEvent = WireEventPayload | WireEventError;

export interface WireEncode {
  (envelope: EventEnvelope): Uint8Array;
}

export interface WireDecode {
  (data: WebSocketData): EventEnvelope;
}

const encodeMsgpack = (value: unknown): Uint8Array => pack(value);

const decodeMsgpack = (payload: Uint8Array): unknown => unpack(payload);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isEventStatus = (value: unknown): value is EventStatus =>
  value === 'sending' || value === 'receiving' || value === 'failed';

const encodeContext = (context: unknown): Uint8Array | undefined => {
  if (!isRecord(context)) {
    return undefined;
  }
  return encodeMsgpack(context);
};

const decodeContext = (payload?: Uint8Array): Record<string, unknown> | undefined => {
  if (!payload) {
    return undefined;
  }
  const decoded = decodeMsgpack(payload);
  return isRecord(decoded) ? decoded : undefined;
};

const encodeEventError = (error: EventError): Uint8Array =>
  encodeMsgpack(error);

const decodeEventError = (payload?: Uint8Array): EventError => {
  if (!payload) {
    return { message: 'Unknown error' };
  }
  const decoded = decodeMsgpack(payload);
  if (isRecord(decoded)) {
    return eventErrorFromRecord(decoded);
  }
  return { message: typeof decoded === 'string' ? decoded : 'Unknown error' };
};

const eventErrorFromRecord = (value: Record<string, unknown>): EventError => {
  const message = typeof value.message === 'string' ? value.message : 'Unknown error';
  const name = typeof value.name === 'string' ? value.name : undefined;
  const stack = typeof value.stack === 'string' ? value.stack : undefined;
  const context = isRecord(value.context) ? value.context : undefined;
  return {
    message,
    ...(name ? { name } : {}),
    ...(stack ? { stack } : {}),
    ...(context ? { context } : {}),
  };
};

const eventErrorFromUnknown = (error: unknown): EventError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.name ? { name: error.name } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  return { message: 'Unknown error' };
};

const uint8ArrayFromUnknown = (value: unknown): Uint8Array | undefined => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return undefined;
};

const binaryFromSocketData = (data: WebSocketData): Uint8Array => {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (typeof data === 'string') {
    throw new Error('Expected binary WebSocket payload.');
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(Buffer.from(data));
};

const defaultEncode: WireEncode = (envelope) => {
  const base: WireEventBase = {
    id: envelope.id,
    event: envelope.event,
    status: envelope.status,
    metadata: envelope.metadata,
    context: encodeContext(envelope.context),
  };
  if (isEnvelopePayload(envelope)) {
    const wire: WireEventPayload = {
      ...base,
      payload: envelope.payload,
    };
    return encodeMsgpack(wire);
  }
  const wire: WireEventError = {
    ...base,
    error: encodeEventError(envelope.error),
  };
  return encodeMsgpack(wire);
};

const defaultDecode: WireDecode = (data) => {
  const parsed = decodeMsgpack(binaryFromSocketData(data)) as WireEvent;
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Invalid WebSocket envelope.');
  }
  if (typeof parsed.id !== 'string') {
    throw new Error('Invalid WebSocket envelope.');
  }
  if (typeof parsed.event !== 'string') {
    throw new Error('Invalid WebSocket envelope.');
  }
  if (!isEventStatus(parsed.status)) {
    throw new Error('Invalid WebSocket envelope.');
  }
  const payload = uint8ArrayFromUnknown(parsed.payload);
  const errorPayload = uint8ArrayFromUnknown(parsed.error);
  const base = {
    id: parsed.id,
    event: parsed.event,
    status: parsed.status,
    metadata: parsed.metadata,
    context: decodeContext(uint8ArrayFromUnknown(parsed.context)),
  };
  if (payload) {
    return {
      ...base,
      payload,
    };
  }
  return {
    ...base,
    error: decodeEventError(errorPayload),
  };
};

const buildClientId = () => randomUUID();

const mergeContext = (
  base?: RuntimeEventContext,
  extra?: RuntimeEventContext,
): RuntimeEventContext | undefined => {
  const baseValue = isRecord(base) ? base : undefined;
  const extraValue = isRecord(extra) ? extra : undefined;
  if (!baseValue && !extraValue) {
    return undefined;
  }
  return { ...(baseValue ?? {}), ...(extraValue ?? {}) };
};

const isEnvelopePayload = (envelope: EventEnvelope): envelope is EventEnvelopePayload =>
  'payload' in envelope && envelope.payload !== undefined;

const isPingEvent = (event: string) => event === 'ping' || event === '$ping';

interface BuildClientContextInput {
  base: Record<string, unknown>;
  info: NodeWsTransportClientInfo;
  getClientContext?: NodeWsTransportClientContext;
}

const buildClientContext = ({ base, info, getClientContext }: BuildClientContextInput) => {
  const extra = getClientContext ? getClientContext(info) : undefined;
  return mergeContext(base, extra);
};

interface BuildReceiveEmitInput {
  envelope: EventEnvelope;
  context: RuntimeEventContext | undefined;
}

const buildReceiveEmitInput = ({ envelope, context }: BuildReceiveEmitInput): EmitInput => {
  const mergedContext = mergeContext(envelope.context, context);
  if (isEnvelopePayload(envelope)) {
    return {
      ...envelope,
      status: 'receiving',
      context: mergedContext,
      payload: envelope.payload,
    };
  }
  return {
    ...envelope,
    status: 'receiving',
    context: mergedContext,
    error: envelope.error,
  };
};

/**
 * nodeWsTransport is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/node-ws-transport
 *
 * @example
 * const result = nodeWsTransport(undefined as never);
 */
export const nodeWsTransport = (options: NodeWsTransportOptions): RuntimeModule => {
  const encode = options.encode ?? defaultEncode;
  const decode = options.decode ?? defaultDecode;
  const onError = options.onError;
  const clients = new Map<WebSocket, NodeWsTransportClientInfo>();

  const register = (registry: RuntimeRegistry) => {
    registry.onSend(async (envelope, ctx, next) => {
      let wire: Uint8Array;
      try {
        wire = encode(envelope);
      } catch (error) {
        if (onError) {
          onError(error, { stage: 'encode' });
        }
        await ctx.emitError({
          ...envelope,
          error: eventErrorFromUnknown(error),
        });
        return next();
      }

      await Promise.all(
        [...clients.values()].map(async (client) => {
          if (client.socket.readyState !== WebSocket.OPEN) {
            return;
          }
          try {
            client.socket.send(wire);
          } catch (error) {
            if (onError) {
              onError(error, { stage: 'send', clientId: client.clientId });
            }
            const clientContext = mergeContext(envelope.context, {
              transport: 'ws',
              clientId: client.clientId,
            });
            await ctx.emitError({
              ...envelope,
              error: eventErrorFromUnknown(error),
              ...(clientContext ? { context: clientContext } : {}),
            });
          }
        }),
      );

      return next();
    });

    registry.onReceive(async (envelope, ctx, next) => {
      if (!isPingEvent(envelope.event)) {
        return next();
      }
      const context = envelope.context ? { ...envelope.context } : undefined;
      if (isEnvelopePayload(envelope)) {
        await ctx.emitEvent({
          event: envelope.event,
          payload: envelope.payload,
          metadata: envelope.metadata,
          context,
        });
        return envelope;
      }
      await ctx.emitEvent({
        event: envelope.event,
        error: envelope.error,
        metadata: envelope.metadata,
        context,
      });
      return envelope;
    });

    options.server.on('connection', (socket, request) => {
      const clientId = buildClientId();
      const info: NodeWsTransportClientInfo = { clientId, socket, request };
      clients.set(socket, info);

      const baseContext = { transport: 'ws', clientId };

      socket.on('message', (data) => {
        try {
          const envelope = decode(data);
          const context = buildClientContext({ base: baseContext, info, getClientContext: options.getClientContext });
          const input = buildReceiveEmitInput({ envelope, context });
          const receive = registry.emitReceive(input);
          receive.catch((error) => {
            if (onError) {
              onError(error, { stage: 'receive', clientId });
            }
          });
        } catch (error) {
          if (onError) {
            onError(error, { stage: 'decode', clientId });
          }
        }
      });

      socket.on('error', (error) => {
        if (onError) {
          onError(error, { stage: 'connection', clientId });
        }
      });

      socket.on('close', () => {
        clients.delete(socket);
        if (options.onClientClose) {
          const run = options.onClientClose({
            clientId,
            socket,
            request,
            emitSend: registry.emitSend,
          });
          Promise.resolve(run).catch((error) => {
            if (onError) {
              onError(error, { stage: 'connection', clientId });
            }
          });
        }
      });
    });
  };

  return {
    name: 'node-ws-transport',
    register,
  };
};
