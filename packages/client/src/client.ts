import { pack, unpack } from 'msgpackr';

export interface ClientRequest {
  (event: string, payload: unknown): Promise<unknown>;
}

export interface ClientTransportConnect {
  (): Promise<void>;
}

export interface ClientTransportClose {
  (): void;
}

export interface UrlLike {
  toString(): string;
}

export interface ReadAccessToken {
  (): string | undefined;
}

export interface WebSocketSend {
  (data: string | Uint8Array): void;
}

export interface WebSocketClose {
  (): void;
}

export interface WebSocketEventListener {
  (event: unknown): void;
}

export interface WebSocketAddEventListener {
  (type: string, listener: WebSocketEventListener): void;
}

export interface WebSocketRemoveEventListener {
  (type: string, listener: WebSocketEventListener): void;
}

export interface WebSocketOn {
  (type: string, listener: WebSocketEventListener): void;
}

export interface WebSocketOff {
  (type: string, listener: WebSocketEventListener): void;
}

export interface WebSocketLike {
  readyState: number;
  binaryType?: string;
  send: WebSocketSend;
  close: WebSocketClose;
  addEventListener?: WebSocketAddEventListener;
  removeEventListener?: WebSocketRemoveEventListener;
  on?: WebSocketOn;
  off?: WebSocketOff;
}

export interface WebSocketImplementation {
  (url: string | URL, protocols?: string | string[]): WebSocketLike;
}

export interface ConfigureLivonClientConfig {
  endpointUrl?: string | UrlLike;
  protocols?: string | string[];
  readAccessToken?: ReadAccessToken;
  WebSocket?: WebSocketImplementation;
  requestTimeoutMilliseconds?: number;
  metadata?: Record<string, unknown>;
}

export interface CreateLivonRemoteFunctionConfig {
  endpointUrl: string;
  remoteIdentifier: string;
  contractVersion: string;
}

export interface LivonRemoteRequest<TPayload> {
  remoteIdentifier: string;
  contractVersion: string;
  payload: TPayload;
}

export interface LivonRemoteSuccessResponse<TResult> {
  success: true;
  result: TResult;
}

export interface LivonRemoteFailureResponse {
  success: false;
  error: LivonRemoteError;
}

export interface LivonRemoteError {
  code: string;
  message: string;
  details?: unknown;
}

export type LivonRemoteResponse<TResult> =
  | LivonRemoteSuccessResponse<TResult>
  | LivonRemoteFailureResponse;

export interface LivonClientError extends Error {
  code: string;
  details?: unknown;
}

export interface LivonRemoteFunction<TPayload, TResult> {
  (payload: TPayload): Promise<TResult>;
}

export interface LivonSubscriptionHandler<TPayload> {
  (payload: TPayload, context: LivonSubscriptionContext): void;
}

export interface LivonSubscriptionContext {
  eventId: string;
  remoteIdentifier: string;
  metadata?: Readonly<Record<string, unknown>>;
  room?: string;
}

export interface RegisterLivonSubscriptionInput<TPayload> {
  remoteIdentifier: string;
  handler: LivonSubscriptionHandler<TPayload>;
}

export interface RegisterLivonSubscriptionResult {
  unsubscribe: LivonUnsubscribe;
}

export interface LivonUnsubscribe {
  (): void;
}

interface LivonClientRuntimeConfig {
  endpointUrl?: string;
  protocols?: string | string[];
  readAccessToken?: ReadAccessToken;
  WebSocket?: WebSocketImplementation;
  requestTimeoutMilliseconds: number;
  metadata: Readonly<Record<string, unknown>>;
}

interface WireEnvelopeBase {
  id: string;
  event: string;
  status: 'sending' | 'receiving' | 'failed';
  metadata?: Readonly<Record<string, unknown>>;
  context?: Uint8Array;
}

interface WireEnvelopePayload extends WireEnvelopeBase {
  payload: Uint8Array;
  error?: never;
}

interface WireEnvelopeError extends WireEnvelopeBase {
  error: Uint8Array;
  payload?: never;
}

type WireEnvelope = WireEnvelopePayload | WireEnvelopeError;

interface PendingRequest {
  event: string;
  resolve: PendingRequestResolve;
  reject: PendingRequestReject;
  timeoutHandle?: ReturnType<typeof setTimeout>;
}

interface PendingRequestResolve {
  (value: unknown): void;
}

interface PendingRequestReject {
  (error: LivonClientError): void;
}

interface SubscriptionEntry {
  remoteIdentifier: string;
  handler: LivonSubscriptionHandler<unknown>;
}

interface MessageEventLike {
  data: string | ArrayBuffer | ArrayBufferView | Uint8Array;
}

interface ErrorRecord {
  message?: unknown;
  code?: unknown;
  details?: unknown;
}

interface RequestRemoteInput<TPayload> extends CreateLivonRemoteFunctionConfig, LivonRemoteRequest<TPayload> {}

interface AddListenerInput {
  target: WebSocketLike;
  type: string;
  listener: WebSocketEventListener;
}

interface RemoveSocketListenerInput {
  cleanupOpen: LivonUnsubscribe;
  cleanupError: LivonUnsubscribe;
}

const DEFAULT_REQUEST_TIMEOUT_MILLISECONDS = 10000;
const READY_OPEN = 1;
const DEFAULT_RUNTIME_CONFIG: LivonClientRuntimeConfig = {
  endpointUrl: undefined,
  protocols: undefined,
  readAccessToken: undefined,
  WebSocket: undefined,
  requestTimeoutMilliseconds: DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  metadata: {},
};

let runtimeConfig = DEFAULT_RUNTIME_CONFIG;
let socket: WebSocketLike | undefined;
let socketEndpointUrl: string | undefined;
let connectPromise: Promise<WebSocketLike> | undefined;
const pendingRequests = new Map<string, PendingRequest>();
const subscriptionEntries = new Map<string, SubscriptionEntry>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isMessageEventLike = (value: unknown): value is MessageEventLike =>
  isRecord(value) && 'data' in value;

const createClientError = ({ code, message, details }: LivonRemoteError): LivonClientError => {
  const error = new Error(message) as LivonClientError;
  error.name = 'LivonClientError';
  error.code = code;
  error.details = details;
  return error;
};

const createUnknownClientError = (message: string): LivonClientError =>
  createClientError({ code: 'LIVON_CLIENT_ERROR', message });

const randomIdentifier = (): string => {
  const cryptoValue = globalThis.crypto;
  if (cryptoValue?.randomUUID) {
    return cryptoValue.randomUUID();
  }
  return `livon_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
};

const binaryFromSocketData = (data: string | ArrayBuffer | ArrayBufferView | Uint8Array): Uint8Array => {
  if (typeof data === 'string') {
    throw new Error('Expected binary Livon WebSocket payload.');
  }
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
};

const decodePayload = (payload: Uint8Array | undefined): unknown => {
  if (!payload) {
    return undefined;
  }
  return unpack(payload);
};

const encodePayload = (payload: unknown): Uint8Array => pack(payload);

const readErrorRecord = (value: unknown): LivonRemoteError => {
  if (!isRecord(value)) {
    return { code: 'LIVON_REMOTE_ERROR', message: 'Livon remote call failed.' };
  }
  const record = value as ErrorRecord;
  return {
    code: typeof record.code === 'string' ? record.code : 'LIVON_REMOTE_ERROR',
    message: typeof record.message === 'string' ? record.message : 'Livon remote call failed.',
    details: record.details,
  };
};

const normalizeRemoteResponse = <TResult>(value: unknown): LivonRemoteResponse<TResult> => {
  if (isRecord(value) && value.success === true) {
    return { success: true, result: value.result as TResult };
  }
  if (isRecord(value) && value.success === false) {
    return { success: false, error: readErrorRecord(value.error) };
  }
  return { success: true, result: value as TResult };
};

const resolveWebSocketImplementation = (): WebSocketImplementation => {
  if (runtimeConfig.WebSocket) {
    return runtimeConfig.WebSocket;
  }
  const globalWebSocket = globalThis.WebSocket;
  if (globalWebSocket) {
    return (url, protocols) => new globalWebSocket(url, protocols);
  }
  throw createUnknownClientError('WebSocket is not available. Configure a WebSocket implementation.');
};

const addListener = ({ target, type, listener }: AddListenerInput): LivonUnsubscribe => {
  if (target.addEventListener) {
    target.addEventListener(type, listener);
    return () => target.removeEventListener?.(type, listener);
  }
  if (target.on) {
    target.on(type, listener);
    return () => target.off?.(type, listener);
  }
  return () => undefined;
};

const rejectAllPending = (error: LivonClientError): void => {
  pendingRequests.forEach((pendingRequest) => {
    if (pendingRequest.timeoutHandle) {
      clearTimeout(pendingRequest.timeoutHandle);
    }
    pendingRequest.reject(error);
  });
  pendingRequests.clear();
};

const handleIncomingEnvelope = (envelope: WireEnvelope): void => {
  const pendingRequest = pendingRequests.get(envelope.id);
  if (pendingRequest) {
    pendingRequests.delete(envelope.id);
    if (pendingRequest.timeoutHandle) {
      clearTimeout(pendingRequest.timeoutHandle);
    }
    if ('error' in envelope) {
      pendingRequest.reject(createClientError(readErrorRecord(decodePayload(envelope.error))));
      return;
    }
    pendingRequest.resolve(decodePayload(envelope.payload));
    return;
  }

  if ('payload' in envelope) {
    const payload = decodePayload(envelope.payload);
    subscriptionEntries.forEach((entry) => {
      if (entry.remoteIdentifier !== envelope.event) {
        return;
      }
      entry.handler(payload, {
        eventId: envelope.id,
        remoteIdentifier: envelope.event,
        metadata: envelope.metadata,
        room: typeof envelope.metadata?.room === 'string' ? envelope.metadata.room : undefined,
      });
    });
  }
};

const handleSocketMessage = (event: unknown): void => {
  const data = isMessageEventLike(event) ? event.data : event;
  const wireEnvelope = unpack(binaryFromSocketData(data as string | ArrayBuffer | ArrayBufferView | Uint8Array)) as WireEnvelope;
  handleIncomingEnvelope(wireEnvelope);
};

const createMetadata = ({ remoteIdentifier, contractVersion }: CreateLivonRemoteFunctionConfig): Record<string, unknown> => {
  const accessToken = runtimeConfig.readAccessToken?.();
  return {
    ...runtimeConfig.metadata,
    remoteIdentifier,
    contractVersion,
    ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
  };
};

const removeSocketListeners = ({ cleanupOpen, cleanupError }: RemoveSocketListenerInput): void => {
  cleanupOpen();
  cleanupError();
};

const openSocket = async (endpointUrl: string): Promise<WebSocketLike> => {
  if (socket?.readyState === READY_OPEN && socketEndpointUrl === endpointUrl) {
    return socket;
  }
  if (connectPromise && socketEndpointUrl === endpointUrl) {
    return connectPromise;
  }

  const WebSocketConstructor = resolveWebSocketImplementation();
  socketEndpointUrl = endpointUrl;
  connectPromise = new Promise<WebSocketLike>((resolve, reject) => {
    const nextSocket = WebSocketConstructor(endpointUrl, runtimeConfig.protocols);
    nextSocket.binaryType = 'arraybuffer';
    const cleanupOpen = addListener({
      target: nextSocket,
      type: 'open',
      listener: () => {
        removeSocketListeners({ cleanupOpen, cleanupError });
        socket = nextSocket;
        connectPromise = undefined;
        resolve(nextSocket);
      },
    });
    const cleanupError = addListener({
      target: nextSocket,
      type: 'error',
      listener: () => {
        removeSocketListeners({ cleanupOpen, cleanupError });
        connectPromise = undefined;
        reject(createUnknownClientError(`Unable to connect to Livon endpoint ${endpointUrl}.`));
      },
    });
    addListener({ target: nextSocket, type: 'message', listener: handleSocketMessage });
    addListener({ target: nextSocket, type: 'close', listener: () => {
      socket = undefined;
      connectPromise = undefined;
      rejectAllPending(createUnknownClientError('Livon WebSocket connection closed.'));
    } });
  });
  return connectPromise;
};

const requestRemote = async <TPayload, TResult>({
  endpointUrl,
  remoteIdentifier,
  contractVersion,
  payload,
}: RequestRemoteInput<TPayload>): Promise<TResult> => {
  const activeSocket = await openSocket(endpointUrl);
  const id = randomIdentifier();
  const wireEnvelope: WireEnvelopePayload = {
    id,
    event: remoteIdentifier,
    status: 'sending',
    metadata: createMetadata({ endpointUrl, remoteIdentifier, contractVersion }),
    payload: encodePayload(payload),
  };

  const rawResponse = await new Promise<unknown>((resolve, reject: PendingRequestReject) => {
    const timeoutHandle = setTimeout(() => {
      pendingRequests.delete(id);
      reject(createUnknownClientError(`Livon request timed out for ${remoteIdentifier}.`));
    }, runtimeConfig.requestTimeoutMilliseconds);
    pendingRequests.set(id, {
      event: remoteIdentifier,
      resolve,
      reject,
      timeoutHandle,
    });
    activeSocket.send(pack(wireEnvelope));
  });
  const response = normalizeRemoteResponse<TResult>(rawResponse);
  if (!response.success) {
    throw createClientError(response.error);
  }
  return response.result;
};

export const configureLivonClient = ({
  endpointUrl,
  protocols,
  readAccessToken,
  WebSocket,
  requestTimeoutMilliseconds = DEFAULT_REQUEST_TIMEOUT_MILLISECONDS,
  metadata = {},
}: ConfigureLivonClientConfig): void => {
  socket?.close();
  socket = undefined;
  socketEndpointUrl = undefined;
  connectPromise = undefined;
  rejectAllPending(createUnknownClientError('Livon client configuration changed.'));
  runtimeConfig = {
    endpointUrl: endpointUrl ? endpointUrl.toString() : runtimeConfig.endpointUrl,
    protocols,
    readAccessToken,
    WebSocket,
    requestTimeoutMilliseconds,
    metadata,
  };
};

export const createLivonRemoteFunction = <TPayload, TResult>({
  endpointUrl,
  remoteIdentifier,
  contractVersion,
}: CreateLivonRemoteFunctionConfig): LivonRemoteFunction<TPayload, TResult> => {
  return (payload: TPayload) =>
    requestRemote<TPayload, TResult>({
      endpointUrl: endpointUrl || runtimeConfig.endpointUrl || '',
      remoteIdentifier,
      contractVersion,
      payload,
    });
};

export const registerLivonSubscription = <TPayload>({
  remoteIdentifier,
  handler,
}: RegisterLivonSubscriptionInput<TPayload>): RegisterLivonSubscriptionResult => {
  const id = randomIdentifier();
  subscriptionEntries.set(id, {
    remoteIdentifier,
    handler: handler as LivonSubscriptionHandler<unknown>,
  });
  return {
    unsubscribe: () => {
      subscriptionEntries.delete(id);
    },
  };
};
