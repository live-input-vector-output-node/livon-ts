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
import { WebSocket } from 'ws';

import type {
  EmitInput,
  EventEnvelope,
  RuntimeContext,
  RuntimeHook,
  RuntimeOnError,
  RuntimeRegistry,
} from '@livon/runtime';

import {
  nodeWsTransport,
  type NodeWsTransportClientCloseInfo,
  type NodeWsTransportClientInfo,
  type NodeWsTransportErrorInfo,
  type NodeWsTransportOptions,
  type WireDecode,
  type WireEncode,
} from './index.js';

vi.mock('node:crypto', () => ({
  randomUUID: vi.fn(() => 'client-1'),
}));

interface MockSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn<(data: Uint8Array) => void>>;
  on: (event: string, listener: (...args: unknown[]) => void) => void;
  emit: (event: string, ...args: unknown[]) => void;
}

const createSocketMock = (input: { readyState?: number } = {}): MockSocket => {
  const listeners = new Map<string, Array<(...args: unknown[]) => void>>();
  const on = (event: string, listener: (...args: unknown[]) => void) => {
    const current = listeners.get(event) ?? [];
    listeners.set(event, [...current, listener]);
  };
  const emit = (event: string, ...args: unknown[]) => {
    (listeners.get(event) ?? []).forEach((listener) => {
      listener(...args);
    });
  };
  return {
    readyState: input.readyState ?? WebSocket.OPEN,
    send: vi.fn<(data: Uint8Array) => void>(() => undefined),
    on,
    emit,
  };
};

interface ServerMockBundle {
  server: NodeWsTransportOptions['server'];
  triggerConnection: (socket: unknown, request?: unknown) => void;
}

const createServerMock = (): ServerMockBundle => {
  let connectionHandler:
    | ((socket: unknown, request?: unknown) => void)
    | undefined;
  const on = vi.fn((event: string, handler: (socket: unknown, request?: unknown) => void) => {
    if (event === 'connection') {
      connectionHandler = handler;
    }
  });
  return {
    server: {
      on,
    } as unknown as NodeWsTransportOptions['server'],
    triggerConnection: (socket: unknown, request?: unknown) => {
      if (!connectionHandler) {
        throw new Error('connection handler must be registered before triggering');
      }
      connectionHandler(socket, request);
    },
  };
};

interface RegistryMockBundle {
  registry: RuntimeRegistry;
  onSend: ReturnType<typeof vi.fn<(hook: RuntimeHook) => { unsub: () => void }>>;
  onReceive: ReturnType<typeof vi.fn<(hook: RuntimeHook) => { unsub: () => void }>>;
  emitReceive: ReturnType<typeof vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>>;
  emitSend: ReturnType<typeof vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>>;
  getOnSendHook: () => RuntimeHook;
  getOnReceiveHook: () => RuntimeHook;
}

const createRegistryMock = (): RegistryMockBundle => {
  let onSendHook: RuntimeHook | undefined;
  let onReceiveHook: RuntimeHook | undefined;

  const onSend = vi.fn<(hook: RuntimeHook) => { unsub: () => void }>((hook: RuntimeHook) => {
    onSendHook = hook;
    return { unsub: vi.fn() };
  });
  const onReceive = vi.fn<(hook: RuntimeHook) => { unsub: () => void }>((hook: RuntimeHook) => {
    onReceiveHook = hook;
    return { unsub: vi.fn() };
  });
  const emitReceive = vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>(async () => ({
    ok: true,
  }));
  const emitSend = vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>(async () => ({
    ok: true,
  }));

  return {
    registry: {
      emitReceive,
      emitSend,
      emitError: vi.fn(async () => ({ ok: true })),
      onReceive,
      onSend,
      onError: vi.fn((hook: RuntimeOnError) => {
        hook;
        return { unsub: vi.fn() };
      }),
      state: {
        get: vi.fn(() => undefined),
        set: vi.fn(() => undefined),
      },
    },
    onSend,
    onReceive,
    emitReceive,
    emitSend,
    getOnSendHook: () => {
      if (!onSendHook) {
        throw new Error('onSend hook must be registered before use');
      }
      return onSendHook;
    },
    getOnReceiveHook: () => {
      if (!onReceiveHook) {
        throw new Error('onReceive hook must be registered before use');
      }
      return onReceiveHook;
    },
  };
};

const createRuntimeContextMock = (): RuntimeContext =>
  ({
    emitEvent: vi.fn(async () => ({ ok: true })),
    emitReceive: vi.fn(async () => ({ ok: true })),
    emitSend: vi.fn(async () => ({ ok: true })),
    emitError: vi.fn(async () => ({ ok: true })),
    room: vi.fn(),
    state: {
      get: vi.fn(() => undefined),
      set: vi.fn(() => undefined),
    },
  }) as unknown as RuntimeContext;

const createEnvelope = (
  overrides: Partial<EventEnvelope> = {},
): EventEnvelope => ({
  id: overrides.id ?? 'evt-1',
  event: overrides.event ?? 'user.updated',
  status: overrides.status ?? 'sending',
  metadata: overrides.metadata,
  context: overrides.context,
  payload: overrides.payload ?? new Uint8Array([1, 2, 3]),
  ...(overrides.error ? { error: overrides.error } : {}),
});

const asEventContext = (value: Record<string, unknown>) =>
  value as unknown as EventEnvelope['context'];

describe('nodeWsTransport()', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should register runtime hooks and server connection handler when register is called', () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const transport = nodeWsTransport({
        server: serverMock.server,
      });

      transport.register(registryMock.registry);

      expect(transport.name).toBe('node-ws-transport');
      expect(registryMock.onSend).toHaveBeenCalledTimes(1);
      expect(registryMock.onReceive).toHaveBeenCalledTimes(1);
      expect(vi.mocked(serverMock.server.on)).toHaveBeenCalledWith(
        'connection',
        expect.any(Function),
      );
    });

    it('should send encoded envelopes only to open clients when onSend hook runs', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const encode: WireEncode = vi.fn(() => new Uint8Array([9, 8, 7]));
      const decode: WireDecode = vi.fn(() => createEnvelope());
      const transport = nodeWsTransport({
        server: serverMock.server,
        encode,
        decode,
      });

      transport.register(registryMock.registry);
      const openSocket = createSocketMock({ readyState: WebSocket.OPEN });
      const closedSocket = createSocketMock({ readyState: 0 });
      serverMock.triggerConnection(openSocket);
      serverMock.triggerConnection(closedSocket);
      const onSendHook = registryMock.getOnSendHook();
      const runtimeContext = createRuntimeContextMock();
      const next = vi.fn(async () => createEnvelope()) as Parameters<RuntimeHook>[2];

      await onSendHook(createEnvelope(), runtimeContext, next);

      expect(encode).toHaveBeenCalledTimes(1);
      expect(openSocket.send).toHaveBeenCalledWith(new Uint8Array([9, 8, 7]));
      expect(closedSocket.send).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should emit ping payload events through runtime context when onReceive sees ping payload', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const transport = nodeWsTransport({
        server: serverMock.server,
      });
      transport.register(registryMock.registry);
      const runtimeContext = createRuntimeContextMock();
      const onReceiveHook = registryMock.getOnReceiveHook();
      const next = vi.fn(async () => createEnvelope()) as Parameters<RuntimeHook>[2];
      const pingEnvelope = createEnvelope({
        event: 'ping',
        metadata: { from: 'client' },
        context: asEventContext({ room: 'a' }),
      });

      const result = await onReceiveHook(pingEnvelope, runtimeContext, next);

      expect(runtimeContext.emitEvent).toHaveBeenCalledWith({
        event: 'ping',
        payload: pingEnvelope.payload,
        metadata: { from: 'client' },
        context: { room: 'a' },
      });
      expect(next).not.toHaveBeenCalled();
      expect(result).toEqual(pingEnvelope);
    });

    it('should pass through non ping events when onReceive sees non ping event', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const transport = nodeWsTransport({
        server: serverMock.server,
      });
      transport.register(registryMock.registry);
      const runtimeContext = createRuntimeContextMock();
      const onReceiveHook = registryMock.getOnReceiveHook();
      const nextEnvelope = createEnvelope({ id: 'next' });
      const next = vi.fn(async () => nextEnvelope) as Parameters<RuntimeHook>[2];

      const result = await onReceiveHook(
        createEnvelope({ event: 'user.updated' }),
        runtimeContext,
        next,
      );

      expect(next).toHaveBeenCalledTimes(1);
      expect(runtimeContext.emitEvent).not.toHaveBeenCalled();
      expect(result).toBe(nextEnvelope);
    });

    it('should decode socket message and emit receive with merged client context when message arrives', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const decodeEnvelope = createEnvelope({
        status: 'sending',
        context: asEventContext({ fromEnvelope: true }),
      });
      const decode: WireDecode = vi.fn(() => decodeEnvelope);
      const getClientContext = vi.fn(
        (_info: NodeWsTransportClientInfo) => ({ fromClientContext: true }),
      );
      const transport = nodeWsTransport({
        server: serverMock.server,
        decode,
        getClientContext,
      });

      transport.register(registryMock.registry);
      const socket = createSocketMock({ readyState: WebSocket.OPEN });
      const request = { url: '/ws' };
      serverMock.triggerConnection(socket, request);

      socket.emit('message', new Uint8Array([1, 2, 3]));
      await Promise.resolve();

      expect(decode).toHaveBeenCalledTimes(1);
      expect(registryMock.emitReceive).toHaveBeenCalledTimes(1);
      expect(registryMock.emitReceive).toHaveBeenCalledWith(
        expect.objectContaining({
          id: decodeEnvelope.id,
          event: decodeEnvelope.event,
          status: 'receiving',
          context: expect.objectContaining({
            transport: 'ws',
            clientId: 'client-1',
            fromEnvelope: true,
            fromClientContext: true,
          }),
        }),
      );
      expect(getClientContext).toHaveBeenCalledWith({
        clientId: 'client-1',
        socket,
        request,
      });
    });

    it('should call onClientClose when socket closes after connection', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const onClientClose = vi.fn(
        async (_info: NodeWsTransportClientCloseInfo) => undefined,
      );
      const onError = vi.fn(
        (_error: unknown, _info: NodeWsTransportErrorInfo) => undefined,
      );
      const transport = nodeWsTransport({
        server: serverMock.server,
        onClientClose,
        onError,
      });

      transport.register(registryMock.registry);
      const socket = createSocketMock({ readyState: WebSocket.OPEN });
      const request = { url: '/ws' };
      serverMock.triggerConnection(socket, request);
      socket.emit('close');
      await Promise.resolve();

      expect(onClientClose).toHaveBeenCalledTimes(1);
      expect(onClientClose).toHaveBeenCalledWith({
        clientId: 'client-1',
        socket,
        request,
        emitSend: registryMock.emitSend,
      });
      expect(onError).not.toHaveBeenCalled();
    });
  });

  describe('sad', () => {
    it('should emit runtime error and report encode stage when encoding fails in onSend', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const onError = vi.fn(
        (_error: unknown, _info: NodeWsTransportErrorInfo) => undefined,
      );
      const encodeError = new Error('encode failed');
      const transport = nodeWsTransport({
        server: serverMock.server,
        encode: () => {
          throw encodeError;
        },
        onError,
      });

      transport.register(registryMock.registry);
      const onSendHook = registryMock.getOnSendHook();
      const runtimeContext = createRuntimeContextMock();
      const envelope = createEnvelope();
      const next = vi.fn(async () => envelope) as Parameters<RuntimeHook>[2];

      await onSendHook(envelope, runtimeContext, next);

      expect(onError).toHaveBeenCalledWith(encodeError, { stage: 'encode' });
      expect(runtimeContext.emitError).toHaveBeenCalledWith(
        expect.objectContaining({
          ...envelope,
          error: expect.objectContaining({
            message: 'encode failed',
            name: 'Error',
          }),
        }),
      );
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should report send stage and emit error when socket send throws', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const onError = vi.fn(
        (_error: unknown, _info: NodeWsTransportErrorInfo) => undefined,
      );
      const transport = nodeWsTransport({
        server: serverMock.server,
        encode: () => new Uint8Array([1]),
        onError,
      });

      transport.register(registryMock.registry);
      const socket = createSocketMock({ readyState: WebSocket.OPEN });
      const sendError = new Error('send failed');
      socket.send.mockImplementationOnce(() => {
        throw sendError;
      });
      serverMock.triggerConnection(socket);
      const onSendHook = registryMock.getOnSendHook();
      const runtimeContext = createRuntimeContextMock();
      const envelope = createEnvelope();
      const next = vi.fn(async () => envelope) as Parameters<RuntimeHook>[2];

      await onSendHook(envelope, runtimeContext, next);

      expect(onError).toHaveBeenCalledWith(sendError, {
        stage: 'send',
        clientId: 'client-1',
      });
      expect(runtimeContext.emitError).toHaveBeenCalledWith(
        expect.objectContaining({
          ...envelope,
          error: expect.objectContaining({
            message: 'send failed',
            name: 'Error',
          }),
          context: {
            transport: 'ws',
            clientId: 'client-1',
          },
        }),
      );
    });

    it('should report decode stage when socket message decode throws', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const onError = vi.fn(
        (_error: unknown, _info: NodeWsTransportErrorInfo) => undefined,
      );
      const decodeError = new Error('decode failed');
      const transport = nodeWsTransport({
        server: serverMock.server,
        decode: () => {
          throw decodeError;
        },
        onError,
      });

      transport.register(registryMock.registry);
      const socket = createSocketMock({ readyState: WebSocket.OPEN });
      serverMock.triggerConnection(socket);
      socket.emit('message', new Uint8Array([3, 2, 1]));
      await Promise.resolve();

      expect(onError).toHaveBeenCalledWith(decodeError, {
        stage: 'decode',
        clientId: 'client-1',
      });
      expect(registryMock.emitReceive).not.toHaveBeenCalled();
    });

    it('should report connection stage when onClientClose handler rejects', async () => {
      const serverMock = createServerMock();
      const registryMock = createRegistryMock();
      const closeError = new Error('close failed');
      const onClientClose = vi.fn(async () => {
        throw closeError;
      });
      const onError = vi.fn(
        (_error: unknown, _info: NodeWsTransportErrorInfo) => undefined,
      );
      const transport = nodeWsTransport({
        server: serverMock.server,
        onClientClose,
        onError,
      });

      transport.register(registryMock.registry);
      const socket = createSocketMock({ readyState: WebSocket.OPEN });
      serverMock.triggerConnection(socket);
      socket.emit('close');
      await Promise.resolve();

      expect(onClientClose).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(closeError, {
        stage: 'connection',
        clientId: 'client-1',
      });
    });
  });
});
