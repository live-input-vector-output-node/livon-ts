import { createServer } from 'node:http';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { WebSocketServer } from 'ws';
import { pack } from 'msgpackr';

import { runtime } from '@livon/runtime';
import { schemaModule } from '@livon/schema';
import { dlqModule, type DlqStoredEvent } from '@livon/dlq-module';
import { nodeWsTransport } from '@livon/node-ws-transport';

import { disconnectUserByClientId, serverSchema } from './schema.js';

export interface CreateServerAppInput {
  path?: string;
  explain?: boolean;
}

export interface ServerApp {
  server: Server;
  wsServer: WebSocketServer;
}

export interface StartServerInput {
  port?: number;
  host?: string;
  path?: string;
  explain?: boolean;
}

export interface StartedServer extends ServerApp {
  url: string;
  port: number;
  host: string;
  close: CloseServer;
}

export interface CloseServer {
  (): Promise<void>;
}

const resolveHost = (host?: string) => host ?? '127.0.0.1';

const resolvePath = (path?: string) => path ?? '/ws';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const contextClientIdFrom = (context?: unknown): string | undefined => {
  if (!isRecord(context)) {
    return undefined;
  }
  return typeof context.clientId === 'string' ? context.clientId : undefined;
};

const listenServer = (server: Server, host: string, port: number) =>
  new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address() as AddressInfo;
      resolve(address.port);
    });
  });

const closeHttpServer = (server: Server) =>
  new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

const closeWsServer = (wsServer: WebSocketServer) =>
  new Promise<void>((resolve, reject) => {
    wsServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });

export const createServerApp = (input: CreateServerAppInput = {}): ServerApp => {
  const path = resolvePath(input.path);
  const dlqEventsById = new Map<string, DlqStoredEvent>();
  const server = createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    res.statusCode = 404;
    res.end();
  });
  const wsServer = new WebSocketServer({ server, path });

  const storeBrokenEvent = async (brokenEvent: DlqStoredEvent) => {
    dlqEventsById.set(brokenEvent.id, brokenEvent);
  };

  const countPendingEvents = () =>
    [...dlqEventsById.values()].filter((event) => event.status !== 'failed').length;

  const loadReadyEvents = () => {
    const now = Date.now();
    const readyEvents = [...dlqEventsById.values()].filter(
      (event) => event.status !== 'failed' && event.timestamp <= now,
    );
    readyEvents.forEach((event) => {
      dlqEventsById.delete(event.id);
    });
    return readyEvents;
  };

  runtime(
    nodeWsTransport({
      server: wsServer,
      onClientClose: async ({ clientId, emitSend }) => {
        const removed = disconnectUserByClientId(clientId);
        if (!removed) {
          return;
        }
        await emitSend({
          event: 'onUserLeft',
          payload: pack(removed),
        });
      },
    }),
    dlqModule({
      maxAttempts: 5,
      storeBrokenEvent,
      countPendingEvents,
      loadReadyEvents,
    }),
    schemaModule(serverSchema, {
      explain: input.explain,
      getRequestContext: (envelope) => {
        const sourceId = contextClientIdFrom(envelope.context);
        return sourceId ? { sourceId } : undefined;
      },
    }),
  );

  return { server, wsServer };
};

export const startServer = async (input: StartServerInput = {}): Promise<StartedServer> => {
  const host = resolveHost(input.host);
  const port = input.port ?? 0;
  const app = createServerApp({ path: input.path, explain: input.explain });
  const actualPort = await listenServer(app.server, host, port);
  const url = `http://${host}:${actualPort}`;
  const close: CloseServer = async () => {
    await closeWsServer(app.wsServer);
    await closeHttpServer(app.server);
  };

  return {
    server: app.server,
    wsServer: app.wsServer,
    url,
    port: actualPort,
    host,
    close,
  };
};
