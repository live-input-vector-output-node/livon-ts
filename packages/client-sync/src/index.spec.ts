import { mkdtemp, rm, writeFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, vi } from 'vitest';
import { pack, unpack } from 'msgpackr';

import {
  normalizeLivonClientSyncConfig,
  resolveLivonGeneratedClientPath,
  startLivonClientSyncWatcher,
  syncLivonClient,
} from './index.js';

const websocketMockState = vi.hoisted(() => ({
  responses: [] as unknown[],
}));

vi.mock('ws', () => {
  type MockListener = (value?: unknown) => void;

  interface MockWebSocketShape {
    sent: Uint8Array[];
    on: (eventName: string, listener: MockListener) => void;
    send: (data: Uint8Array) => void;
    close: () => void;
  }

  interface CreateMockWebSocketInput {
    listeners: Map<string, MockListener[]>;
  }

  interface EmitInput {
    listeners: Map<string, MockListener[]>;
    eventName: string;
    value?: unknown;
  }

  const emit = ({ listeners, eventName, value }: EmitInput): void => {
    (listeners.get(eventName) ?? []).forEach((listener) => {
      listener(value);
    });
  };

  const createMockWebSocket = ({ listeners }: CreateMockWebSocketInput): MockWebSocketShape => {
    const socket: MockWebSocketShape = {
      sent: [],
      on: (eventName, listener) => {
        listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
      },
      send: (data) => {
        socket.sent.push(data);
        const envelope = unpack(data) as ExplainEnvelope;
        const response = websocketMockState.responses.shift();
        setTimeout(() => {
          if (!response) {
            emit({ listeners, eventName: 'error', value: new Error('Mock Livon explain endpoint unavailable.') });
            return;
          }
          emit({
            listeners,
            eventName: 'message',
            value: pack({
              id: typeof envelope.id === 'string' ? envelope.id : 'test',
              event: '$explain',
              status: 'receiving',
              payload: pack(response),
            }),
          });
        }, 0);
      },
      close: () => undefined,
    };
    setTimeout(() => {
      emit({ listeners, eventName: 'open' });
    }, 0);
    return socket;
  };

  const MockWebSocket = new Proxy(vi.fn(), {
    construct: () => createMockWebSocket({ listeners: new Map() }),
  });

  return { default: MockWebSocket };
});

interface ExplainServer {
  url: string;
  close: CloseExplainServer;
}

type CloseExplainServer = () => Promise<void>;

interface ExplainResponse {
  ast: Record<string, unknown>;
  checksum: string;
  schemaVersion: string;
  generatedAt: string;
}

interface ExplainEnvelope {
  id?: unknown;
}

interface CreateExplainServerInput {
  response: ExplainResponse;
}

const createAst = (): Record<string, unknown> => ({
  type: 'api',
  children: [
    {
      type: 'object',
      name: 'get-user-input',
      children: [
        { type: 'field', name: 'userIdentifier', children: [{ type: 'string' }] },
      ],
    },
    {
      type: 'object',
      name: 'user-response',
      children: [
        { type: 'field', name: 'displayName', children: [{ type: 'string' }] },
        { type: 'field', name: 'age', children: [{ type: 'number' }] },
        { type: 'field', name: 'active', children: [{ type: 'boolean' }] },
        { type: 'field', name: 'createdAt', children: [{ type: 'date' }] },
        { type: 'field', name: 'avatar', children: [{ type: 'binary' }] },
        { type: 'field', name: 'kind', children: [{ type: 'literal', constraints: { value: 'user' } }] },
        { type: 'field', name: 'coordinates', children: [{ type: 'tuple', children: [{ type: 'number' }, { type: 'number' }] }] },
        {
          type: 'field',
          name: 'combined',
          children: [{ type: 'and', children: [{ type: 'object', name: 'get-user-input' }, { type: 'object', name: 'status' }] }],
        },
        { type: 'field', name: 'roles', children: [{ type: 'array', children: [{ type: 'string' }] }] },
      ],
    },
    {
      type: 'enum',
      name: 'status',
      constraints: { values: ['active', 'disabled'] },
    },
    {
      type: 'operation',
      name: 'user.getUser',
      children: [
        { type: 'object', name: 'get-user-input' },
        { type: 'object', name: 'user-response' },
      ],
    },
    {
      type: 'operation',
      name: 'user.ping',
      children: [
        { type: 'object', children: [{ type: 'field', name: 'message', children: [{ type: 'string' }] }] },
        { type: 'object', children: [{ type: 'field', name: 'ok', children: [{ type: 'boolean' }] }] },
      ],
    },
    {
      type: 'subscription',
      name: 'user.changed',
      children: [
        { type: 'object', name: 'user-response' },
      ],
    },
  ],
});

const createExplainServer = async ({ response }: CreateExplainServerInput): Promise<ExplainServer> => {
  websocketMockState.responses.length = 0;
  websocketMockState.responses.push(response, response, response);
  return {
    url: 'ws://127.0.0.1:3002/ws',
    close: () => Promise.resolve(),
  };
};

const createCache = async (projectRoot: string): Promise<void> => {
  const outputDirectory = path.join(projectRoot, '.livon/generated');
  await mkdir(outputDirectory, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDirectory, 'client.ts'), 'export {};\n', 'utf8'),
    writeFile(path.join(outputDirectory, 'client.d.ts'), 'export {};\n', 'utf8'),
    writeFile(path.join(outputDirectory, 'manifest.json'), '{"schemaVersion":"1","contractVersion":"a","contractHash":"a","generatedAt":"now","endpointUrl":"ws://localhost/ws","remoteFunctions":[],"subscriptions":[],"types":[]}\n', 'utf8'),
    writeFile(path.join(outputDirectory, 'meta.json'), '{"schemaVersion":"1","contractVersion":"a","contractHash":"a","generatedAt":"now"}\n', 'utf8'),
  ]);
};

describe('client sync helpers', () => {
  it('normalizes websocket sync config defaults', () => {
    const config = normalizeLivonClientSyncConfig({ url: ' ws://localhost/ws ' });

    expect(config.url).toBe('ws://localhost/ws');
    expect(config.outputDirectory).toBe('.livon/generated');
    expect(config.importIdentifier).toBe('@livon/generated');
    expect(config.syncMode).toBe('startup');
    expect(config.failureMode).toBe('warnAndUseCache');
  });

  it('calculates generated client alias targets', () => {
    expect(resolveLivonGeneratedClientPath({
      config: { url: 'ws://localhost/ws' },
      projectRoot: '/repo',
    })).toBe('/repo/.livon/generated/client.ts');
  });

  it('rejects non-websocket sync URLs', () => {
    expect(() => normalizeLivonClientSyncConfig({ url: 'https://localhost/ws' })).toThrow(
      'Livon client sync URL must be a ws:// or wss:// $explain endpoint.',
    );
  });

  it('uses cache when sync fails and cache exists', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    await createCache(projectRoot);

    const result = await syncLivonClient({
      config: {
        url: 'ws://127.0.0.1:1/ws',
        projectRoot,
        timeoutMilliseconds: 10,
        failureMode: 'useCache',
      },
    });

    expect(result.status).toBe('cache');
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('warns before using cache when warnAndUseCache is configured', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    const warnings: string[] = [];
    await createCache(projectRoot);

    const result = await syncLivonClient({
      config: {
        url: 'ws://127.0.0.1:1/ws',
        projectRoot,
        timeoutMilliseconds: 10,
        failureMode: 'warnAndUseCache',
      },
      logger: {
        warn: (message) => {
          warnings.push(message);
        },
      },
    });

    expect(result.status).toBe('cache');
    expect(warnings[0]).toContain('Using generated client cache.');
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('fails when sync fails and cache is missing', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));

    await expect(syncLivonClient({
      config: {
        url: 'ws://127.0.0.1:1/ws',
        projectRoot,
        timeoutMilliseconds: 10,
        failureMode: 'useCache',
      },
    })).rejects.toThrow();

    await rm(projectRoot, { recursive: true, force: true });
  });

  it('syncs websocket explain metadata into physical generated files', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    const server = await createExplainServer({
      response: {
        ast: createAst(),
        checksum: 'contract-hash-1',
        schemaVersion: '1',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    });

    const result = await syncLivonClient({
      config: {
        url: server.url,
        projectRoot,
        failureMode: 'error',
        timeoutMilliseconds: 500,
      },
    });

    const [clientSource, declarationSource, manifestSource, metaSource] = await Promise.all([
      readFile(path.join(projectRoot, '.livon/generated/client.ts'), 'utf8'),
      readFile(path.join(projectRoot, '.livon/generated/client.d.ts'), 'utf8'),
      readFile(path.join(projectRoot, '.livon/generated/manifest.json'), 'utf8'),
      readFile(path.join(projectRoot, '.livon/generated/meta.json'), 'utf8'),
    ]);
    expect(result.status).toBe('updated');
    expect(clientSource).toContain("import { createLivonRemoteFunction, registerLivonSubscription } from '@livon/client';");
    expect(clientSource).toContain("remoteIdentifier: \"user.getUser\"");
    expect(clientSource).toContain("contractVersion: \"contract-hash-1\"");
    expect(clientSource).not.toContain('/src/');
    expect(declarationSource).toContain('export declare const userGetUser: UserGetUserFunction;');
    expect(JSON.parse(manifestSource)).toMatchObject({
      contractHash: 'contract-hash-1',
    });
    expect(JSON.parse(manifestSource).remoteFunctions).toEqual(
      expect.arrayContaining([expect.objectContaining({ remoteIdentifier: 'user.getUser' })]),
    );
    expect(JSON.parse(metaSource)).toMatchObject({ contractHash: 'contract-hash-1' });

    await server.close();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('skips artifact writes when the websocket checksum is unchanged', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    const server = await createExplainServer({
      response: {
        ast: createAst(),
        checksum: 'contract-hash-1',
        schemaVersion: '1',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    });

    await syncLivonClient({ config: { url: server.url, projectRoot, failureMode: 'error', timeoutMilliseconds: 500 } });
    const result = await syncLivonClient({ config: { url: server.url, projectRoot, failureMode: 'error', timeoutMilliseconds: 500 } });

    expect(result.status).toBe('unchanged');
    expect(result.meta.contractHash).toBe('contract-hash-1');

    await server.close();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('hashes websocket AST metadata when explain omits a checksum', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    const server = await createExplainServer({
      response: {
        ast: createAst(),
        checksum: '',
        schemaVersion: '1',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    });

    const result = await syncLivonClient({
      config: {
        url: server.url,
        projectRoot,
        failureMode: 'error',
        timeoutMilliseconds: 500,
      },
    });

    expect(result.status).toBe('updated');
    expect(result.meta.contractHash).toHaveLength(64);
    await server.close();
    await rm(projectRoot, { recursive: true, force: true });
  });

  it('starts and stops the polling watcher', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'livon-client-sync-'));
    const server = await createExplainServer({
      response: {
        ast: createAst(),
        checksum: 'watch-hash-1',
        schemaVersion: '1',
        generatedAt: '2026-05-19T00:00:00.000Z',
      },
    });

    const watcher = startLivonClientSyncWatcher({
      config: {
        url: server.url,
        projectRoot,
        failureMode: 'error',
        watchPollIntervalMilliseconds: 10,
      },
    });
    watcher.stop();
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });

    await expect(readFile(path.join(projectRoot, '.livon/generated/meta.json'), 'utf8')).resolves.toContain('watch-hash-1');
    await server.close();
    await rm(projectRoot, { recursive: true, force: true });
  });
});
