import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FAILURE_MODE,
  DEFAULT_IMPORT_IDENTIFIER,
  DEFAULT_OUTPUT_DIRECTORY,
  DEFAULT_SYNC_MODE,
  DEFAULT_TIMEOUT_MILLISECONDS,
  type LivonContractManifest,
  type LivonContractMeta,
} from './index.js';

describe('@livon/contract', () => {
  it('exports plugin sync defaults', () => {
    expect(DEFAULT_OUTPUT_DIRECTORY).toBe('.livon/generated');
    expect(DEFAULT_IMPORT_IDENTIFIER).toBe('@livon/generated');
    expect(DEFAULT_SYNC_MODE).toBe('startup');
    expect(DEFAULT_FAILURE_MODE).toBe('warnAndUseCache');
    expect(DEFAULT_TIMEOUT_MILLISECONDS).toBe(10000);
  });

  it('models public contract metadata and manifests without private implementation fields', () => {
    const meta: LivonContractMeta = {
      schemaVersion: '1',
      contractVersion: 'contract-a',
      contractHash: 'hash-a',
      generatedAt: '2026-05-19T00:00:00.000Z',
    };
    const manifest: LivonContractManifest = {
      ...meta,
      endpointUrl: 'ws://127.0.0.1:3002/ws',
      remoteFunctions: [
        {
          name: 'user.getUser',
          exportName: 'userGetUser',
          remoteIdentifier: 'user.getUser',
          inputTypeName: 'GetUserInput',
          responseTypeName: 'User',
        },
      ],
      subscriptions: [],
      types: [{ name: 'User', kind: 'object' }],
    };

    expect(JSON.stringify(manifest)).not.toContain('src/');
    expect(JSON.stringify(manifest)).not.toContain('process.env');
    expect(manifest.remoteFunctions[0]?.remoteIdentifier).toBe('user.getUser');
  });
});
