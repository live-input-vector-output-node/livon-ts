import { clientWsTransport, type ClientWsTransport } from '@livon/client-ws-transport';
import { runtime } from '@livon/runtime';
import { create } from 'zustand';

import { api } from '../generated/api.js';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  connect: () => Promise<void>;
  ensureConnected: () => Promise<void>;
  disconnect: () => void;
}

let transport: ClientWsTransport | null = null;
let started = false;

const resolveWsUrl = () => {
  const { protocol, hostname } = window.location;
  const wsProtocol = protocol === 'https:' ? 'wss:' : 'ws:';
  const port = 3002;
  return `${wsProtocol}//${hostname}:${port}/ws`;
};

const normalizeError = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown connection error';
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'idle',
  error: undefined,
  connect: async () => {
    if (started && transport) {
      await transport.connect();
      set({ status: 'connected', error: undefined });
      return;
    }

    set({ status: 'connecting', error: undefined });

    const wsUrl = resolveWsUrl();
    transport = clientWsTransport({
      url: wsUrl,
      onError: (error, info) => {
        if (info.stage === 'close') {
          set({ status: 'idle', error: undefined });
          return;
        }
        set({ status: 'error', error: normalizeError(error) });
      },
    });

    runtime(transport, api);

    try {
      await transport.connect();
      started = true;
      set({ status: 'connected', error: undefined });
    } catch (error) {
      set({ status: 'error', error: normalizeError(error) });
    }
  },
  ensureConnected: async () => {
    await useConnectionStore.getState().connect();
  },
  disconnect: () => {
    set({ status: 'idle', error: undefined });
    started = false;
    transport?.close();
    transport = null;
  },
}));
