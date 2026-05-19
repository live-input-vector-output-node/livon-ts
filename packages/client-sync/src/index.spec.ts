import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';

import {
  normalizeLivonClientSyncConfig,
  resolveLivonGeneratedClientPath,
  syncLivonClient,
} from './index.js';

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
});
