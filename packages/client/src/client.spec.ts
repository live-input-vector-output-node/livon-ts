import { describe, expect, it } from 'vitest';
import { pack, unpack } from 'msgpackr';

import {
  configureLivonClient,
  createLivonRemoteFunction,
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
    close: () => undefined,
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
});
