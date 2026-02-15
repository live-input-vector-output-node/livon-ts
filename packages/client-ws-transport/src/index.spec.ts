import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type { RuntimeRegistry } from '@livon/runtime';

import {
  clientWsTransport,
  type ClientWebSocketConstructor,
  type ClientWebSocketEventListener,
  type ClientWebSocketLike,
  type ClientWsTransportErrorInfo,
  type ClientWsTransportOptions,
  type WebSocketData,
} from './index.js';

interface MockClientSocket extends ClientWebSocketLike {
  emit: (event: string, payload?: unknown) => void;
}

interface RegistryMockBundle {
  registry: RuntimeRegistry;
  stateSet: ReturnType<typeof vi.fn<(key: string, value: unknown) => void>>;
  emitReceive: ReturnType<typeof vi.fn<(input: unknown) => Promise<{ ok: boolean }>>>;
}

const createRegistryMock = (): RegistryMockBundle => {
  const stateSet = vi.fn<(key: string, value: unknown) => void>(() => undefined);
  const emitReceive = vi.fn<(input: unknown) => Promise<{ ok: boolean }>>(async () => ({
    ok: true,
  }));
  return {
    registry: {
      emitReceive: emitReceive as RuntimeRegistry['emitReceive'],
      emitSend: vi.fn(async () => ({ ok: true })),
      emitError: vi.fn(async () => ({ ok: true })),
      onReceive: vi.fn(() => ({ unsub: vi.fn() })),
      onSend: vi.fn(() => ({ unsub: vi.fn() })),
      onError: vi.fn(() => ({ unsub: vi.fn() })),
      state: {
        get: vi.fn(() => undefined),
        set: stateSet,
      },
    },
    stateSet,
    emitReceive,
  };
};

const createClientSocketMock = (): MockClientSocket => {
  const listeners = new Map<string, ClientWebSocketEventListener[]>();
  const addEventListener = (type: string, listener: ClientWebSocketEventListener) => {
    const current = listeners.get(type) ?? [];
    listeners.set(type, [...current, listener]);
  };
  const removeEventListener = (type: string, listener: ClientWebSocketEventListener) => {
    const current = listeners.get(type) ?? [];
    listeners.set(
      type,
      current.filter((entry) => entry !== listener),
    );
  };

  const socket = {
    readyState: 0,
    binaryType: 'arraybuffer',
    send: vi.fn<(data: WebSocketData) => void>(() => undefined),
    close: vi.fn<(code?: number, reason?: string) => void>(() => {
      socket.readyState = 3;
      socket.emit('close');
    }),
    addEventListener,
    removeEventListener,
    on: undefined,
    off: undefined,
    emit: (event: string, payload?: unknown) => {
      (listeners.get(event) ?? []).forEach((listener) => {
        listener(payload);
      });
    },
  } as MockClientSocket;

  return socket;
};

interface WebSocketCtorBundle {
  ctor: ClientWebSocketConstructor;
  sockets: MockClientSocket[];
}

const createWebSocketCtor = (): WebSocketCtorBundle => {
  const sockets: MockClientSocket[] = [];
  const ctorImpl = function WebSocketCtor(_url: string, _protocols?: string | string[]) {
    const socket = createClientSocketMock();
    sockets.push(socket);
    return socket;
  };
  const ctor = vi.fn(ctorImpl) as unknown as ClientWebSocketConstructor;
  return { ctor, sockets };
};

const createOptions = (
  overrides: Partial<ClientWsTransportOptions> = {},
): ClientWsTransportOptions => ({
  url: 'ws://127.0.0.1:3002/ws',
  ...overrides,
});

describe('clientWsTransport()', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should expose runtime module and client transport methods when transport is created', () => {
      const socketCtor = createWebSocketCtor();

      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
        }),
      );

      expect(transport.name).toBe('client-ws-transport');
      expect(typeof transport.register).toBe('function');
      expect(typeof transport.request).toBe('function');
      expect(typeof transport.connect).toBe('function');
      expect(typeof transport.close).toBe('function');
    });

    it('should register request function in runtime state when register is called', () => {
      const socketCtor = createWebSocketCtor();
      const registryMock = createRegistryMock();
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          requestKey: 'custom.request.key',
        }),
      );

      transport.register(registryMock.registry);

      expect(registryMock.stateSet).toHaveBeenCalledTimes(1);
      expect(registryMock.stateSet).toHaveBeenCalledWith(
        'custom.request.key',
        transport.request,
      );
    });

    it('should resolve request when matching correlation response message is received', async () => {
      const socketCtor = createWebSocketCtor();
      const onError = vi.fn(
        (_error: unknown, _info: ClientWsTransportErrorInfo) => undefined,
      );
      const cryptoValue = (
        globalThis as unknown as {
          crypto?: { randomUUID?: () => string };
        }
      ).crypto;
      if (cryptoValue?.randomUUID) {
        vi.spyOn(cryptoValue, 'randomUUID').mockReturnValue('corr-fixed');
      }
      const encode = vi.fn(() => new Uint8Array([7]));
      const decode = vi.fn(() => ({
        id: 'resp-1',
        event: 'getUser',
        status: 'sending' as const,
        metadata: { correlationId: 'corr-fixed' },
        payload: new Uint8Array([9]),
      }));
      const payloadEncode = vi.fn(() => new Uint8Array([1]));
      const payloadDecode = vi.fn(() => 'decoded-user');
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          encode,
          decode,
          payloadEncode,
          payloadDecode,
          onError,
          requestTimeoutMs: 100,
        }),
      );
      transport.register(createRegistryMock().registry);

      const requestPromise = transport.request('getUser', { id: 1 });
      const requestResult = requestPromise
        .then((value: unknown) => ({ value }))
        .catch((error: unknown) => ({ error }));
      const socket = socketCtor.sockets[0];
      if (!socket) {
        throw new Error('socket should exist after request');
      }
      socket.readyState = 1;
      socket.emit('open');
      await transport.connect();
      expect(socket.send).toHaveBeenCalledTimes(1);
      socket.emit('message', { data: new Uint8Array([2]) });

      const settled = await requestResult;
      expect('value' in settled).toBe(true);
      if ('value' in settled) {
        expect(settled.value).toBe('decoded-user');
      }
      expect(payloadEncode).toHaveBeenCalledWith({ id: 1 });
      expect(encode).toHaveBeenCalledTimes(1);
      expect(decode).toHaveBeenCalledTimes(1);
      expect(payloadDecode).toHaveBeenCalledWith(new Uint8Array([9]));
      expect(socket.send).toHaveBeenCalledWith(new Uint8Array([7]));
      expect(onError).not.toHaveBeenCalled();
    });

    it('should emit receive and onEvent when message does not match pending request', async () => {
      const socketCtor = createWebSocketCtor();
      const onEvent = vi.fn();
      const payloadDecode = vi.fn(() => new Uint8Array([4]));
      const decodeEnvelope = {
        id: 'evt-1',
        event: 'broadcast',
        status: 'sending' as const,
        metadata: { source: 'server' },
        payload: new Uint8Array([5]),
      };
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          decode: () => decodeEnvelope,
          payloadDecode,
          onEvent,
        }),
      );
      const registryMock = createRegistryMock();
      transport.register(registryMock.registry);

      const connectPromise = transport.connect();
      const socket = socketCtor.sockets[0];
      if (!socket) {
        throw new Error('socket should exist after connect');
      }
      socket.readyState = 1;
      socket.emit('open');
      await connectPromise;
      socket.emit('message', { data: new Uint8Array([8]) });
      await Promise.resolve();

      expect(registryMock.emitReceive).toHaveBeenCalledTimes(1);
      expect(registryMock.emitReceive).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-1',
          event: 'broadcast',
          status: 'receiving',
          payload: new Uint8Array([4]),
        }),
      );
      expect(onEvent).toHaveBeenCalledWith(decodeEnvelope);
    });
  });

  describe('sad', () => {
    it('should reject request and report encode stage when encode throws', async () => {
      const socketCtor = createWebSocketCtor();
      const onError = vi.fn(
        (_error: unknown, _info: ClientWsTransportErrorInfo) => undefined,
      );
      const encodeError = new Error('encode failed');
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          encode: () => {
            throw encodeError;
          },
          onError,
        }),
      );

      await expect(transport.request('broken', { a: 1 })).rejects.toThrow('encode failed');
      expect(onError).toHaveBeenCalledWith(
        encodeError,
        expect.objectContaining({
          stage: 'encode',
          correlationId: expect.any(String),
        }),
      );
    });

    it('should report decode stage when decode fails for incoming message', async () => {
      const socketCtor = createWebSocketCtor();
      const onError = vi.fn(
        (_error: unknown, _info: ClientWsTransportErrorInfo) => undefined,
      );
      const decodeError = new Error('decode failed');
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          decode: () => {
            throw decodeError;
          },
          onError,
        }),
      );
      transport.register(createRegistryMock().registry);
      const connectPromise = transport.connect();
      const socket = socketCtor.sockets[0];
      if (!socket) {
        throw new Error('socket should exist after connect');
      }
      socket.readyState = 1;
      socket.emit('open');
      await connectPromise;

      socket.emit('message', { data: new Uint8Array([1]) });
      await Promise.resolve();

      expect(onError).toHaveBeenCalledWith(decodeError, { stage: 'decode' });
    });

    it('should reject request and report timeout stage when response does not arrive in time', async () => {
      vi.useFakeTimers();
      const socketCtor = createWebSocketCtor();
      const onError = vi.fn(
        (_error: unknown, _info: ClientWsTransportErrorInfo) => undefined,
      );
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          encode: () => new Uint8Array([1]),
          payloadEncode: () => new Uint8Array([2]),
          requestTimeoutMs: 10,
          onError,
        }),
      );

      const requestPromise = transport.request('slow', { id: 1 });
      const timeoutResult = requestPromise
        .then(() => new Error('request should timeout'))
        .catch((error: unknown) => error);
      const socket = socketCtor.sockets[0];
      if (!socket) {
        throw new Error('socket should exist after request');
      }
      socket.readyState = 1;
      socket.emit('open');
      await Promise.resolve();

      await vi.advanceTimersByTimeAsync(20);

      const timeoutError = await timeoutResult;
      expect(timeoutError).toBeInstanceOf(Error);
      expect((timeoutError as Error).message).toBe('Request timed out: slow');
      expect(onError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          stage: 'timeout',
          correlationId: expect.any(String),
        }),
      );
    });

    it('should reject new request when queue is full and dropOldest is disabled', async () => {
      const socketCtor = createWebSocketCtor();
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          encode: () => new Uint8Array([1]),
          payloadEncode: () => new Uint8Array([2]),
          queueEnabled: true,
          queueMaxSize: 1,
          queueDropOldest: false,
        }),
      );

      const firstRequest = transport.request('first', { id: 1 });
      const secondRequest = transport.request('second', { id: 2 });

      await expect(secondRequest).rejects.toThrow('Request queue full: second');
      transport.close();
      await expect(firstRequest).rejects.toThrow('WebSocket closed');
    });

    it('should reject pending request and close socket when close is called', async () => {
      const socketCtor = createWebSocketCtor();
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          encode: () => new Uint8Array([7]),
          payloadEncode: () => new Uint8Array([8]),
        }),
      );

      const requestPromise = transport.request('pending', { id: 1 });
      const socket = socketCtor.sockets[0];
      if (!socket) {
        throw new Error('socket should exist after request');
      }

      transport.close();

      await expect(requestPromise).rejects.toThrow('WebSocket closed');
      expect(socket.close).toHaveBeenCalledTimes(1);
    });

    it('should reject connect when connect timeout is reached before open', async () => {
      vi.useFakeTimers();
      const socketCtor = createWebSocketCtor();
      const onError = vi.fn(
        (_error: unknown, _info: ClientWsTransportErrorInfo) => undefined,
      );
      const transport = clientWsTransport(
        createOptions({
          WebSocket: socketCtor.ctor,
          connectTimeoutMs: 10,
          onError,
        }),
      );

      const connectPromise = transport.connect();
      const connectResult = connectPromise
        .then(() => new Error('connect should timeout'))
        .catch((error: unknown) => error);
      await vi.advanceTimersByTimeAsync(20);

      const connectError = await connectResult;
      expect(connectError).toBeInstanceOf(Error);
      expect((connectError as Error).message).toBe('WebSocket connection timeout');
      expect(onError).toHaveBeenCalledWith(expect.any(Error), { stage: 'connection' });
    });
  });
});
