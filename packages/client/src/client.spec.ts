import { describe, expect, it } from 'vitest';
import { pack, unpack } from 'msgpackr';

import {
  configureLivonClient,
  createLivonRemoteFunction,
  registerLivonSubscription,
  type WebSocketEventListener,
  type WebSocketLike,
} from './index.js';

interface TestSocket extends WebSocketLike {
  emit: TestSocketEmit;
  sent: Uint8Array[];
}

interface TestSocketEmit {
  (type: string, event?: unknown): void;
}

interface CreateSocketConstructorInput {
  socket: TestSocket;
}

interface WaitForClientTick {
  (): Promise<void>;
}

const waitForClientTick: WaitForClientTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const createTestSocket = (): TestSocket => {
  const listeners = new Map<string, WebSocketEventListener[]>();
  const socket: TestSocket = {
    readyState: 0,
    sent: [],
    send: (data) => {
      if (data instanceof Uint8Array) {
        socket.sent.push(data);
      }
    },
    close: () => {
      socket.readyState = 3;
    },
    addEventListener: (type, listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    removeEventListener: (type, listener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
    },
    emit: (type, event) => {
      if (type === 'open') {
        socket.readyState = 1;
      }
      (listeners.get(type) ?? []).forEach((listener) => listener(event));
    },
  };
  return socket;
};

const createSocketConstructor = ({ socket }: CreateSocketConstructorInput) => {
  return () => socket;
};

const createNodeStyleTestSocket = (): TestSocket => {
  const listeners = new Map<string, WebSocketEventListener[]>();
  const socket: TestSocket = {
    readyState: 0,
    sent: [],
    send: (data) => {
      if (data instanceof Uint8Array) {
        socket.sent.push(data);
      }
    },
    close: () => {
      socket.readyState = 3;
    },
    on: (type, listener) => {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    },
    off: (type, listener) => {
      listeners.set(type, (listeners.get(type) ?? []).filter((entry) => entry !== listener));
    },
    emit: (type, event) => {
      if (type === 'open') {
        socket.readyState = 1;
      }
      (listeners.get(type) ?? []).forEach((listener) => listener(event));
    },
  };
  return socket;
};

describe('createLivonRemoteFunction()', () => {
  it('returns successful remote results from websocket responses', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');
    await waitForClientTick();
    const sent = socket.sent[0];
    expect(sent).toBeDefined();
    const request = unpack(sent ?? new Uint8Array()) as { id: string };
    socket.emit('message', {
      data: pack({
        id: request.id,
        event: 'user.readUser',
        status: 'receiving',
        payload: pack({ success: true, result: { displayName: 'Ada' } }),
      }),
    });

    await expect(promise).resolves.toEqual({ displayName: 'Ada' });
  });

  it('throws typed errors from failed remote responses', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');
    await waitForClientTick();
    const sent = socket.sent[0];
    expect(sent).toBeDefined();
    const request = unpack(sent ?? new Uint8Array()) as { id: string };
    socket.emit('message', {
      data: pack({
        id: request.id,
        event: 'user.readUser',
        status: 'failed',
        payload: pack({
          success: false,
          error: { code: 'NOT_FOUND', message: 'User not found.' },
        }),
      }),
    });

    await expect(promise).rejects.toMatchObject({
      name: 'LivonClientError',
      code: 'NOT_FOUND',
      message: 'User not found.',
    });
  });

  it('sends configured metadata and access tokens with raw payloads', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      readAccessToken: () => 'token-1',
      metadata: { tenant: 'demo' },
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');
    await waitForClientTick();
    const sent = socket.sent[0];
    expect(sent).toBeDefined();
    const request = unpack(sent ?? new Uint8Array()) as {
      id: string;
      event: string;
      metadata: Record<string, unknown>;
      payload: Uint8Array;
    };
    socket.emit('message', {
      data: pack({
        id: request.id,
        event: 'user.readUser',
        status: 'receiving',
        payload: pack({ displayName: 'Ada' }),
      }),
    });

    expect(request.event).toBe('user.readUser');
    expect(request.metadata).toMatchObject({
      authorization: 'Bearer token-1',
      contractVersion: 'hash-1',
      remoteIdentifier: 'user.readUser',
      tenant: 'demo',
    });
    expect(unpack(request.payload)).toEqual({ userIdentifier: '123' });
    await expect(promise).resolves.toEqual({ displayName: 'Ada' });
  });

  it('throws typed errors from websocket error envelopes', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');
    await waitForClientTick();
    const request = unpack(socket.sent[0] ?? new Uint8Array()) as { id: string };
    socket.emit('message', {
      data: pack({
        id: request.id,
        event: 'user.readUser',
        status: 'failed',
        error: pack({ code: 'DENIED', message: 'Access denied.' }),
      }),
    });

    await expect(promise).rejects.toMatchObject({
      name: 'LivonClientError',
      code: 'DENIED',
      message: 'Access denied.',
    });
  });

  it('rejects requests that time out', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 1,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');

    await expect(promise).rejects.toMatchObject({
      name: 'LivonClientError',
      code: 'LIVON_CLIENT_ERROR',
      message: 'Livon request timed out for user.readUser.',
    });
  });

  it('reuses open node-style websocket connections', async () => {
    const socket = createNodeStyleTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const firstPromise = readUser({ userIdentifier: '123' });
    const secondPromise = readUser({ userIdentifier: '456' });
    socket.emit('open');
    await waitForClientTick();
    const firstRequest = unpack(socket.sent[0] ?? new Uint8Array()) as { id: string };
    const secondRequest = unpack(socket.sent[1] ?? new Uint8Array()) as { id: string };
    socket.emit('message', pack({
      id: firstRequest.id,
      event: 'user.readUser',
      status: 'receiving',
      payload: pack({ displayName: 'Ada' }),
    }));
    socket.emit('message', pack({
      id: secondRequest.id,
      event: 'user.readUser',
      status: 'receiving',
      payload: pack({ displayName: 'Grace' }),
    }));

    await expect(firstPromise).resolves.toEqual({ displayName: 'Ada' });
    await expect(secondPromise).resolves.toEqual({ displayName: 'Grace' });
  });

  it('rejects pending requests when the websocket closes', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('open');
    await waitForClientTick();
    socket.emit('close');

    await expect(promise).rejects.toMatchObject({
      name: 'LivonClientError',
      code: 'LIVON_CLIENT_ERROR',
      message: 'Livon WebSocket connection closed.',
    });
  });

  it('rejects websocket connection failures', async () => {
    const socket = createTestSocket();
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const readUser = createLivonRemoteFunction<{ userIdentifier: string }, { displayName: string }>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    });

    const promise = readUser({ userIdentifier: '123' });
    socket.emit('error');

    await expect(promise).rejects.toMatchObject({
      name: 'LivonClientError',
      code: 'LIVON_CLIENT_ERROR',
      message: 'Unable to connect to Livon endpoint ws://localhost/ws.',
    });
  });
});

describe('registerLivonSubscription()', () => {
  it('delivers websocket subscription payloads and supports unsubscribe', async () => {
    const socket = createTestSocket();
    const received: unknown[] = [];
    configureLivonClient({
      WebSocket: createSocketConstructor({ socket }),
      requestTimeoutMilliseconds: 50,
    });
    const subscription = registerLivonSubscription({
      remoteIdentifier: 'user.changed',
      handler: (payload, context) => {
        received.push({ payload, context });
      },
    });
    const connect = createLivonRemoteFunction<Record<string, never>, Record<string, never>>({
      endpointUrl: 'ws://localhost/ws',
      remoteIdentifier: 'user.readUser',
      contractVersion: 'hash-1',
    })({});
    socket.emit('open');
    await waitForClientTick();
    const request = unpack(socket.sent[0] ?? new Uint8Array()) as { id: string };
    socket.emit('message', {
      data: pack({
        id: request.id,
        event: 'user.readUser',
        status: 'receiving',
        payload: pack({}),
      }),
    });
    await connect;

    socket.emit('message', {
      data: pack({
        id: 'event-1',
        event: 'user.changed',
        status: 'receiving',
        metadata: { room: 'global' },
        payload: pack({ displayName: 'Grace' }),
      }),
    });
    subscription.unsubscribe();
    socket.emit('message', {
      data: pack({
        id: 'event-2',
        event: 'user.changed',
        status: 'receiving',
        payload: pack({ displayName: 'Ignored' }),
      }),
    });

    expect(received).toEqual([
      {
        payload: { displayName: 'Grace' },
        context: {
          eventId: 'event-1',
          remoteIdentifier: 'user.changed',
          metadata: { room: 'global' },
          room: 'global',
        },
      },
    ]);
  });
});
