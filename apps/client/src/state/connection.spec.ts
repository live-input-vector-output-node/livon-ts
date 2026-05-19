import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { configureLivonClient } from '@livon/client';
import { useConnectionStore } from './connection.js';

vi.mock('@livon/client', () => ({
  configureLivonClient: vi.fn(),
}));

interface WindowLocationInput {
  protocol: string;
  hostname: string;
}

const setWindowLocation = ({ protocol, hostname }: WindowLocationInput): void => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      location: {
        protocol,
        hostname,
      },
    },
  });
};

describe('connection state', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useConnectionStore.getState().disconnect();
    setWindowLocation({ protocol: 'http:', hostname: 'localhost' });
  });

  afterEach(() => {
    useConnectionStore.getState().disconnect();
  });

  it('configures the Livon client with a websocket endpoint', async () => {
    await useConnectionStore.getState().connect();

    expect(configureLivonClient).toHaveBeenCalledWith({ endpointUrl: 'ws://localhost:3002/ws' });
    expect(useConnectionStore.getState().status).toBe('connected');
  });

  it('uses secure websocket URLs on HTTPS pages', async () => {
    setWindowLocation({ protocol: 'https:', hostname: 'livon.test' });

    await useConnectionStore.getState().connect();

    expect(configureLivonClient).toHaveBeenCalledWith({ endpointUrl: 'wss://livon.test:3002/ws' });
  });

  it('reuses an existing connection without reconfiguring the runtime', async () => {
    await useConnectionStore.getState().connect();
    vi.clearAllMocks();

    await useConnectionStore.getState().ensureConnected();

    expect(configureLivonClient).not.toHaveBeenCalled();
    expect(useConnectionStore.getState().status).toBe('connected');
  });
});
