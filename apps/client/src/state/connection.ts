import { configureLivonClient } from '@livon/client';
import { create } from 'zustand';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ConnectionState {
  status: ConnectionStatus;
  error?: string;
  connect: () => Promise<void>;
  ensureConnected: () => Promise<void>;
  disconnect: () => void;
}

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
    if (started) {
      set({ status: 'connected', error: undefined });
      return;
    }

    set({ status: 'connecting', error: undefined });

    const wsUrl = resolveWsUrl();
    configureLivonClient({ endpointUrl: wsUrl });

    try {
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
  },
}));
