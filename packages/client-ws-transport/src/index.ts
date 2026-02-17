/**
 * Public package entrypoint for `@livon/client-ws-transport`.
 *
 * @see https://livon.tech/docs/packages/client-ws-transport
 */
import type { ClientRequest, ClientTransportClose, ClientTransportConnect } from '@livon/client';
import type {
  EmitInput,
  EventEnvelope,
  EventEnvelopePayload,
  EventError,
  EventStatus,
  RuntimeEventContext,
  RuntimeModule,
  RuntimeRegistry,
} from '@livon/runtime';
import { pack, unpack } from 'msgpackr';

export type WebSocketData = string | ArrayBuffer | ArrayBufferView | Uint8Array;

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
  (envelope: EventEnvelope): string | Uint8Array;
}

export interface WireDecode {
  (data: WebSocketData): EventEnvelope;
}

export interface ClientWebSocketSend {
  (data: WebSocketData): void;
}

export interface ClientWebSocketClose {
  (code?: number, reason?: string): void;
}

export interface ClientWebSocketEventListener {
  (...args: unknown[]): void;
}

export interface ClientWebSocketAddEventListener {
  (type: string, listener: ClientWebSocketEventListener): void;
}

export interface ClientWebSocketRemoveEventListener {
  (type: string, listener: ClientWebSocketEventListener): void;
}

export interface ClientWebSocketOn {
  (type: string, listener: ClientWebSocketEventListener): void;
}

export interface ClientWebSocketOff {
  (type: string, listener: ClientWebSocketEventListener): void;
}

export interface ClientWebSocket {
  readyState: number;
  binaryType?: string;
  send: ClientWebSocketSend;
  close: ClientWebSocketClose;
}

export interface ClientWebSocketLike extends ClientWebSocket {
  addEventListener?: ClientWebSocketAddEventListener;
  removeEventListener?: ClientWebSocketRemoveEventListener;
  on?: ClientWebSocketOn;
  off?: ClientWebSocketOff;
}

export interface ClientWebSocketConstructor {
  new (url: string, protocols?: string | string[]): ClientWebSocketLike;
}

export type ClientWsTransportErrorStage =
  | 'encode'
  | 'decode'
  | 'send'
  | 'receive'
  | 'connection'
  | 'close'
  | 'timeout';

export interface ClientWsTransportErrorInfo {
  stage: ClientWsTransportErrorStage;
  correlationId?: string;
}

export interface ClientWsTransportOnError {
  (error: unknown, info: ClientWsTransportErrorInfo): void;
}

export interface ClientWsTransportOnEvent {
  (envelope: EventEnvelope): void;
}

export interface UrlLike {
  toString(): string;
}

export interface ClientWsTransportOptions {
  url: string | UrlLike;
  protocols?: string | string[];
  encode?: WireEncode;
  decode?: WireDecode;
  payloadEncode?: ClientWsTransportPayloadEncode;
  payloadDecode?: ClientWsTransportPayloadDecode;
  onError?: ClientWsTransportOnError;
  onEvent?: ClientWsTransportOnEvent;
  WebSocket?: ClientWebSocketConstructor;
  connectTimeoutMs?: number;
  requestTimeoutMs?: number;
  reconnect?: boolean;
  reconnectDelayMs?: number;
  reconnectPollIntervalMs?: number;
  requestKey?: string;
  queueEnabled?: boolean;
  queueMaxSize?: number;
  queueDropOldest?: boolean;
}

export interface ClientWsTransport extends RuntimeModule {
  request: ClientRequest;
  connect: ClientTransportConnect;
  close: ClientTransportClose;
}

export interface ClientWsTransportPayloadEncode {
  (value: unknown): Uint8Array;
}

export interface ClientWsTransportPayloadDecode {
  (payload: Uint8Array): unknown;
}

export interface CryptoRandomUUID {
  (): string;
}

export interface CryptoLike {
  randomUUID?: CryptoRandomUUID;
}

export interface GlobalCrypto {
  crypto?: CryptoLike;
}

export interface GlobalWebSocket {
  WebSocket?: ClientWebSocketConstructor;
}

export type TimerHandle = number;

export interface TimerHandler {
  (): void;
}

export interface TimerSet {
  (handler: TimerHandler, timeout: number): TimerHandle;
}

export interface TimerClear {
  (handle: TimerHandle): void;
}

export interface GlobalTimers {
  setTimeout?: TimerSet;
  clearTimeout?: TimerClear;
}

export interface PendingRequestResolve {
  (value: unknown): void;
}

export interface PendingRequestReject {
  (error: Error): void;
}

export interface PendingRequest {
  event: string;
  resolve: PendingRequestResolve;
  reject: PendingRequestReject;
  timeoutId?: TimerHandle;
}

interface QueuedRequest extends PendingRequest {
  correlationId: string;
  wire: string | Uint8Array;
}

export interface WebSocketMessageEvent {
  data: WebSocketData;
}

export interface ErrorWithContext extends Error {
  context?: Readonly<Record<string, unknown>>;
}

const READY_OPEN = 1;

const scheduleTimeout = (handler: TimerHandler, timeout: number): TimerHandle | undefined => {
  const timers = globalThis as GlobalTimers;
  return timers.setTimeout ? timers.setTimeout(handler, timeout) : undefined;
};

const cancelTimeout = (handle?: TimerHandle) => {
  if (handle === undefined) {
    return;
  }
  const timers = globalThis as GlobalTimers;
  if (timers.clearTimeout) {
    timers.clearTimeout(handle);
  }
};

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

const decodeContext = (payload?: Uint8Array): RuntimeEventContext | undefined => {
  if (!payload) {
    return undefined;
  }
  const decoded = decodeMsgpack(payload);
  return isRecord(decoded) ? (decoded as RuntimeEventContext) : undefined;
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
  const error: EventError = { message };
  if (name) {
    error.name = name;
  }
  if (stack) {
    error.stack = stack;
  }
  if (context) {
    error.context = context;
  }
  return error;
};

const uint8ArrayFromSocketData = (data: WebSocketData): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  throw new Error('Unsupported WebSocket payload.');
};

const binaryFromSocketData = (data: WebSocketData): Uint8Array => {
  if (typeof data === 'string') {
    throw new Error('Expected binary WebSocket payload.');
  }
  return uint8ArrayFromSocketData(data);
};

const isEnvelopePayload = (envelope: EventEnvelope): envelope is EventEnvelopePayload =>
  'payload' in envelope && envelope.payload !== undefined;

const isWirePayload = (event: WireEvent): event is WireEventPayload =>
  'payload' in event && event.payload instanceof Uint8Array;

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
    return pack(wire);
  }
  const wire: WireEventError = {
    ...base,
    error: encodeEventError(envelope.error),
  };
  return pack(wire);
};

const defaultDecode: WireDecode = (data) => {
  const parsed = unpack(binaryFromSocketData(data)) as WireEvent;
  if (
    !isRecord(parsed)
    || typeof parsed.id !== 'string'
    || typeof parsed.event !== 'string'
    || !isEventStatus(parsed.status)
  ) {
    throw new Error('Invalid WebSocket envelope.');
  }
  const base = {
    id: parsed.id,
    event: parsed.event,
    status: parsed.status,
    metadata: parsed.metadata,
    context: decodeContext(parsed.context),
  };
  if (isWirePayload(parsed)) {
    return {
      ...base,
      payload: parsed.payload,
    };
  }
  return {
    ...base,
    error: decodeEventError(parsed.error),
  };
};

const resolveWebSocketCtor = (input?: ClientWebSocketConstructor): ClientWebSocketConstructor => {
  if (input) {
    return input;
  }
  const globalCtor = (globalThis as GlobalWebSocket).WebSocket;
  if (globalCtor) {
    return globalCtor;
  }
  throw new Error('WebSocket constructor is not available. Provide ClientWsTransportOptions.WebSocket.');
};

const createCorrelationId = () => {
  const cryptoValue = (globalThis as GlobalCrypto).crypto;
  if (cryptoValue?.randomUUID) {
    return cryptoValue.randomUUID();
  }
  const random = Math.random().toString(16).slice(2);
  const time = Date.now().toString(16);
  return `corr_${random}_${time}`;
};

const getCorrelationId = (metadata?: Readonly<Record<string, unknown>>) =>
  typeof metadata?.correlationId === 'string' ? metadata.correlationId : undefined;

const errorFromEventError = (error: EventError): Error => {
  const err = new Error(error.message);
  if (error.name) {
    err.name = error.name;
  }
  if (error.stack) {
    err.stack = error.stack;
  }
  if (error.context) {
    (err as ErrorWithContext).context = error.context;
  }
  return err;
};

interface AddListenerInput {
  socket: ClientWebSocketLike;
  event: string;
  handler: ClientWebSocketEventListener;
}

const addListener = ({ socket, event, handler }: AddListenerInput) => {
  if (typeof socket.addEventListener === 'function') {
    socket.addEventListener(event, handler);
    return () => socket.removeEventListener?.(event, handler);
  }
  if (typeof socket.on === 'function') {
    socket.on(event, handler);
    return () => socket.off?.(event, handler);
  }
  return () => undefined;
};

const isMessageEvent = (value: unknown): value is WebSocketMessageEvent =>
  typeof value === 'object' && value !== null && 'data' in value;

type ArrayBufferLike = { arrayBuffer: () => Promise<ArrayBuffer> };

const isArrayBufferLike = (value: unknown): value is ArrayBufferLike =>
  typeof value === 'object' &&
  value !== null &&
  'arrayBuffer' in value &&
  typeof (value as ArrayBufferLike).arrayBuffer === 'function';

interface BuildReceiveEmitInput {
  envelope: EventEnvelope;
  decodePayload: ClientWsTransportPayloadDecode;
}

const buildReceiveEmitInput = ({ envelope, decodePayload }: BuildReceiveEmitInput): EmitInput => {
  const base = {
    ...envelope,
    status: 'receiving' as const,
  };
  if (isEnvelopePayload(envelope)) {
    return {
      ...base,
      payload: decodePayload(envelope.payload) as unknown as Uint8Array,
    };
  }
  return {
    ...base,
    error: envelope.error,
  };
};

/**
 * clientWsTransport is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/client-ws-transport
 *
 * @example
 * const result = clientWsTransport(undefined as never);
 */
export const clientWsTransport = (options: ClientWsTransportOptions): ClientWsTransport => {
  const encode = options.encode ?? defaultEncode;
  const decode = options.decode ?? defaultDecode;
  const encodePayload = options.payloadEncode ?? encodeMsgpack;
  const decodePayload = options.payloadDecode ?? decodeMsgpack;
  const onError = options.onError;
  const onEvent = options.onEvent;
  const shouldReconnect = options.reconnect ?? true;
  const reconnectDelayMs = options.reconnectDelayMs ?? 1000;
  const reconnectPollIntervalMs = options.reconnectPollIntervalMs ?? reconnectDelayMs;
  const queueEnabled = options.queueEnabled ?? true;
  const queueMaxSize = options.queueMaxSize ?? 500;
  const queueDropOldest = options.queueDropOldest ?? true;
  const url = typeof options.url === 'string' ? options.url : options.url.toString();
  const requestKey = options.requestKey ?? 'livon.client.request';
  const protocols = options.protocols;
  const pending = new Map<string, PendingRequest>();
  const queued: QueuedRequest[] = [];
  let registry: RuntimeRegistry | null = null;

  let socket: ClientWebSocketLike | null = null;
  let connectPromise: Promise<ClientWebSocketLike> | null = null;
  let reconnectTimer: TimerHandle | undefined;
  let reconnectPollTimer: TimerHandle | undefined;
  let reconnectRequested = false;

  const reportError = (error: unknown, info: ClientWsTransportErrorInfo) => {
    if (onError) {
      onError(error, info);
    }
  };

  const rejectAllPending = (error: Error) => {
    pending.forEach((entry) => {
      cancelTimeout(entry.timeoutId);
      entry.reject(error);
    });
    pending.clear();
  };

  const scheduleReconnect = () => {
    if (!shouldReconnect || !reconnectRequested) {
      return;
    }
    if (reconnectTimer) {
      return;
    }
    reconnectTimer = scheduleTimeout(() => {
      reconnectTimer = undefined;
      void ensureSocket().catch((error) => {
        reportError(error, { stage: 'connection' });
        scheduleReconnect();
      });
    }, reconnectDelayMs);
  };

  const clearReconnectPoll = () => {
    cancelTimeout(reconnectPollTimer);
    reconnectPollTimer = undefined;
  };

  const scheduleReconnectPoll = () => {
    if (!shouldReconnect || !reconnectRequested) {
      return;
    }
    if (reconnectPollTimer) {
      return;
    }
    reconnectPollTimer = scheduleTimeout(() => {
      reconnectPollTimer = undefined;
      if (!reconnectRequested) {
        return;
      }
      if (socket && socket.readyState === READY_OPEN) {
        scheduleReconnectPoll();
        return;
      }
      void ensureSocket()
        .then(() => {
          void flushQueued();
        })
        .catch((error) => {
          reportError(error, { stage: 'connection' });
        })
        .finally(() => {
          scheduleReconnectPoll();
        });
    }, reconnectPollIntervalMs);
  };

  const handleClose = () => {
    const error = new Error('WebSocket closed');
    socket = null;
    connectPromise = null;
    rejectAllPending(error);
    reportError(error, { stage: 'close' });
    scheduleReconnect();
    scheduleReconnectPoll();
  };

  const handleEnvelope = (envelope: EventEnvelope) => {
    const correlationId = getCorrelationId(envelope.metadata);
    if (correlationId) {
      const entry = pending.get(correlationId);
      if (entry) {
        pending.delete(correlationId);
        cancelTimeout(entry.timeoutId);
        if (isEnvelopePayload(envelope)) {
          entry.resolve(decodePayload(envelope.payload));
        } else {
          entry.reject(errorFromEventError(envelope.error));
        }
        if (envelope.event === entry.event) {
          return;
        }
      }
    }
    if (registry) {
      void registry.emitReceive(
        buildReceiveEmitInput({
          envelope,
          decodePayload,
        }),
      );
    }
    if (onEvent) {
      onEvent(envelope);
    }
  };

  const handleBinary = (data: WebSocketData) => {
    try {
      const envelope = decode(data);
      handleEnvelope(envelope);
    } catch (error) {
      reportError(error, { stage: 'decode' });
    }
  };

  const handleMessage = (value: unknown) => {
    const data = isMessageEvent(value) ? value.data : (value as WebSocketData);
    if (isArrayBufferLike(data)) {
      data.arrayBuffer()
        .then((buffer: ArrayBuffer) => {
          handleBinary(new Uint8Array(buffer));
        })
        .catch((error: unknown) => {
          reportError(error, { stage: 'decode' });
        });
      return;
    }
    handleBinary(data);
  };

  const ensureSocket = async () => {
    if (socket && socket.readyState === READY_OPEN) {
      return socket;
    }
    if (socket && socket.readyState !== READY_OPEN) {
      socket = null;
      connectPromise = null;
    }
    if (connectPromise) {
      return connectPromise;
    }

    const WebSocketCtor = resolveWebSocketCtor(options.WebSocket);
    const ws = new WebSocketCtor(url, protocols);
    socket = ws;

    addListener({ socket: ws, event: 'message', handler: handleMessage });

    connectPromise = new Promise<ClientWebSocketLike>((resolve, reject) => {
      const cleanup = () => {
        openUnsub();
        errorUnsub();
        closeUnsub();
        cancelTimeout(timeoutId);
      };

      const handleOpen = () => {
        cleanup();
        addListener({ socket: ws, event: 'close', handler: handleClose });
        addListener({
          socket: ws,
          event: 'error',
          handler: (error) => {
          const err = error instanceof Error ? error : new Error('WebSocket error');
          reportError(err, { stage: 'connection' });
          },
        });
        clearReconnectPoll();
        resolve(ws);
      };

      const handleError = (error: unknown) => {
        const err = error instanceof Error ? error : new Error('WebSocket connection error');
        cleanup();
        socket = null;
        connectPromise = null;
        reportError(err, { stage: 'connection' });
        scheduleReconnect();
        scheduleReconnectPoll();
        reject(err);
      };

      const handlePrematureClose = () => {
        const err = new Error('WebSocket closed before open');
        cleanup();
        socket = null;
        connectPromise = null;
        reportError(err, { stage: 'connection' });
        scheduleReconnect();
        scheduleReconnectPoll();
        reject(err);
      };

      const openUnsub = addListener({ socket: ws, event: 'open', handler: handleOpen });
      const errorUnsub = addListener({ socket: ws, event: 'error', handler: handleError });
      const closeUnsub = addListener({ socket: ws, event: 'close', handler: handlePrematureClose });
      const timeoutId =
        typeof options.connectTimeoutMs === 'number' && options.connectTimeoutMs > 0
          ? scheduleTimeout(() => {
              handleError(new Error('WebSocket connection timeout'));
              if (ws.readyState !== READY_OPEN) {
                ws.close();
              }
            }, options.connectTimeoutMs)
          : undefined;
    });

    return connectPromise;
  };

  const enqueue = (entry: QueuedRequest) => {
    if (queued.length >= queueMaxSize) {
      if (queueDropOldest && queued.length > 0) {
        const dropped = queued.shift();
        if (dropped) {
          dropped.reject(new Error(`Request dropped from queue: ${dropped.event}`));
        }
      } else {
        entry.reject(new Error(`Request queue full: ${entry.event}`));
        return;
      }
    }
    queued.push(entry);
  };

  const sendQueued = (ws: ClientWebSocketLike, entry: QueuedRequest) => {
    const timeoutId =
      typeof options.requestTimeoutMs === 'number' && options.requestTimeoutMs > 0
        ? scheduleTimeout(() => {
            const error = new Error(`Request timed out: ${entry.event}`);
            pending.delete(entry.correlationId);
            reportError(error, { stage: 'timeout', correlationId: entry.correlationId });
            entry.reject(error);
          }, options.requestTimeoutMs)
        : undefined;

    pending.set(entry.correlationId, {
      event: entry.event,
      resolve: entry.resolve,
      reject: entry.reject,
      timeoutId,
    });

    try {
      ws.send(entry.wire);
    } catch (error) {
      const pendingEntry = pending.get(entry.correlationId);
      cancelTimeout(pendingEntry?.timeoutId);
      pending.delete(entry.correlationId);
      reportError(error, { stage: 'send', correlationId: entry.correlationId });
      throw error;
    }
  };

  const flushQueued = async () => {
    if (queued.length === 0) {
      return;
    }
    let ws: ClientWebSocketLike;
    try {
      ws = await ensureSocket();
    } catch {
      return;
    }
    const flushNext = () => {
      const next = queued.shift();
      if (!next) {
        return;
      }
      try {
        sendQueued(ws, next);
      } catch {
        queued.unshift(next);
        scheduleReconnect();
        scheduleReconnectPoll();
        return;
      }
      flushNext();
    };
    flushNext();
  };

  const request = async (event: string, payload: unknown) => {
    const correlationId = createCorrelationId();
    const envelopeData = {
      event,
      payload: encodePayload(payload),
      metadata: { correlationId },
    };
    const envelope: EventEnvelope = {
      ...envelopeData,
      id: correlationId,
      status: 'sending',
    };

    let wire: string | Uint8Array;
    try {
      wire = encode(envelope);
    } catch (error) {
      reportError(error, { stage: 'encode', correlationId });
      throw error;
    }

    reconnectRequested = true;

    return new Promise<unknown>((resolve, reject) => {
      const pendingEntry = { event, resolve, reject };
      const entry: QueuedRequest = {
        ...pendingEntry,
        correlationId,
        wire,
      };

      const canSendNow = socket && socket.readyState === READY_OPEN;
      if (canSendNow) {
        try {
          sendQueued(socket as ClientWebSocketLike, entry);
          return;
        } catch (error) {
          if (!queueEnabled) {
            reject(error as Error);
            return;
          }
        }
      }

      if (!queueEnabled) {
        void ensureSocket()
          .then((ws) => {
            sendQueued(ws, entry);
          })
          .catch((error) => {
            reportError(error, { stage: 'send', correlationId });
            reject(error instanceof Error ? error : new Error('WebSocket send failed'));
          });
        return;
      }

      enqueue(entry);
      scheduleReconnect();
      scheduleReconnectPoll();
      void ensureSocket()
        .then(() => {
          void flushQueued();
        })
        .catch((error) => {
          reportError(error, { stage: 'connection' });
        });
    });
  };

  const connect = async () => {
    reconnectRequested = true;
    await ensureSocket();
    await flushQueued();
    scheduleReconnectPoll();
  };

  const close = () => {
    reconnectRequested = false;
    cancelTimeout(reconnectTimer);
    reconnectTimer = undefined;
    clearReconnectPoll();
    queued.splice(0).forEach((entry) => {
      entry.reject(new Error('WebSocket closed'));
    });
    if (!socket) {
      return;
    }
    const target = socket;
    socket = null;
    connectPromise = null;
    rejectAllPending(new Error('WebSocket closed'));
    target.close();
  };

  const register = (input: RuntimeRegistry) => {
    registry = input;
    input.state.set(requestKey, request);
  };

  return { name: 'client-ws-transport', register, request, connect, close };
};
