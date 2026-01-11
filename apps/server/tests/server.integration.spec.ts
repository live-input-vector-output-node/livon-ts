import { describe, it, afterAll, beforeAll, expect } from 'vitest';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import type { RawData } from 'ws';
import { pack, unpack } from 'msgpackr';

import { createServerApp } from '../src/server.js';

export interface WireEventBase {
  id: string;
  event: string;
  status: 'sending' | 'receiving' | 'failed';
  metadata?: Readonly<Record<string, unknown>>;
  context?: Uint8Array | Record<string, unknown>;
}

export interface WireEventPayload extends WireEventBase {
  payload: Uint8Array;
  error?: never;
}

export interface WireEventError extends WireEventBase {
  error: {
    message: string;
    name?: string;
    stack?: string;
    context?: Record<string, unknown>;
  };
  payload?: never;
}

export type WireEvent = WireEventPayload | WireEventError;

interface RequestEnvelopeInput {
  id: string;
  event: string;
  payload: unknown;
}

const toUint8Array = (data: RawData): Uint8Array => {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  throw new Error('Expected binary WebSocket payload.');
};

const buildRequestEnvelope = ({ id, event, payload }: RequestEnvelopeInput): WireEventPayload => ({
  id,
  event,
  status: 'sending',
  payload: pack(payload),
});

const decodeContext = (value: Uint8Array | Record<string, unknown> | undefined) => {
  if (!value) {
    return undefined;
  }
  if (value instanceof Uint8Array) {
    return unpack(value) as Record<string, unknown>;
  }
  return value;
};

const openSocket = async (url: string) =>
  new Promise<WebSocket>((resolve, reject) => {
    const socket = new WebSocket(url);
    socket.once('open', () => resolve(socket));
    socket.once('error', reject);
  });

const closeSocket = async (socket: WebSocket) =>
  new Promise<void>((resolve) => {
    if (socket.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }
    socket.once('close', () => resolve());
    socket.close();
  });

const receiveEvent = async (socket: WebSocket) =>
  new Promise<WireEvent>((resolve, reject) => {
    socket.once('message', (data) => {
      try {
        const event = unpack(toUint8Array(data)) as WireEvent;
        resolve(event);
      } catch (error) {
        reject(error);
      }
    });
    socket.once('error', reject);
  });

const sendAndReceive = async (url: string, input: RequestEnvelopeInput) => {
  const socket = await openSocket(url);
  try {
    socket.send(pack(buildRequestEnvelope(input)));
    return await receiveEvent(socket);
  } finally {
    await closeSocket(socket);
  }
};

describe('server ws transport', () => {
  let server: ReturnType<typeof createServerApp>['server'];
  let baseWsUrl = '';

  beforeAll(async () => {
    const app = createServerApp();
    server = app.server;
    const port = await new Promise<number>((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', () => {
        const address = server.address() as AddressInfo;
        resolve(address.port);
      });
    });
    baseWsUrl = `ws://127.0.0.1:${port}/ws`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  });

  it('responds to ping from transport', async () => {
    const payload = { message: 'hello' };
    const response = await sendAndReceive(baseWsUrl, {
      id: 'test-ping',
      event: 'ping',
      payload,
    });
    expect(response.event).toBe('ping');
    expect(response.status).toBe('sending');
    const context = decodeContext(response.context);
    expect(context).toMatchObject({ transport: 'ws' });
    expect(typeof context?.clientId).toBe('string');
    if ('payload' in response && response.payload) {
      expect(unpack(response.payload)).toEqual(payload);
      return;
    }
    throw new Error('Expected payload response');
  });

  it('handles operations via schema module', async () => {
    const input = { _id: 'user-1' };
    const response = await sendAndReceive(baseWsUrl, {
      id: 'test-get-user',
      event: 'user',
      payload: input,
    });
    expect(response.event).toBe('user');
    expect(response.status).toBe('sending');
    if ('payload' in response && response.payload) {
      expect(unpack(response.payload)).toEqual({ _id: 'user-1', name: 'User-user-1' });
      return;
    }
    throw new Error('Expected payload response');
  });

  it('handles field operations via schema module', async () => {
    const payload = { dependsOn: { _id: 'user-2', name: 'Ada' } };
    const response = await sendAndReceive(baseWsUrl, {
      id: 'test-user-greeting',
      event: '$User.greeting',
      payload,
    });
    expect(response.event).toBe('$User.greeting');
    expect(response.status).toBe('sending');
    if ('payload' in response && response.payload) {
      expect(unpack(response.payload)).toEqual('Hello Ada');
      return;
    }
    throw new Error('Expected payload response');
  });
});
