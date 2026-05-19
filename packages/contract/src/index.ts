export const DEFAULT_OUTPUT_DIRECTORY = '.livon/generated';
export const DEFAULT_IMPORT_IDENTIFIER = '@livon/generated';
export const DEFAULT_SYNC_MODE = 'startup';
export const DEFAULT_FAILURE_MODE = 'warnAndUseCache';
export const DEFAULT_TIMEOUT_MILLISECONDS = 10000;
export const DEFAULT_WATCH_POLL_INTERVAL_MILLISECONDS = 2000;

export type LivonSyncMode = 'startup' | 'build' | 'watch' | 'manual';

export type LivonFailureMode = 'error' | 'warnAndUseCache' | 'useCache';

export type LivonGeneratedArtifactName =
  | 'client.ts'
  | 'client.d.ts'
  | 'manifest.json'
  | 'meta.json';

export interface LivonClientSyncPluginConfig {
  url: string;
  outputDirectory?: string;
  importIdentifier?: string;
  syncMode?: LivonSyncMode;
  failureMode?: LivonFailureMode;
  requestHeaders?: Record<string, string>;
  timeoutMilliseconds?: number;
}

export interface LivonClientSyncConfig extends LivonClientSyncPluginConfig {
  projectRoot?: string;
  watchPollIntervalMilliseconds?: number;
}

export interface LivonContractMeta {
  schemaVersion: string;
  contractVersion: string;
  contractHash: string;
  generatedAt: string;
}

export interface LivonRemoteFunctionDefinition {
  name: string;
  exportName: string;
  remoteIdentifier: string;
  inputTypeName?: string;
  responseTypeName?: string;
}

export interface LivonSubscriptionDefinition {
  name: string;
  payloadTypeName?: string;
  inputTypeName?: string;
  responseTypeName?: string;
}

export interface LivonTypeDefinition {
  name: string;
  kind: string;
}

export interface LivonContractManifest {
  schemaVersion: string;
  contractVersion: string;
  contractHash: string;
  generatedAt: string;
  endpointUrl: string;
  remoteFunctions: readonly LivonRemoteFunctionDefinition[];
  subscriptions: readonly LivonSubscriptionDefinition[];
  types: readonly LivonTypeDefinition[];
}

export interface LivonGeneratedArtifactContents {
  clientSource: string;
  clientDeclarationSource: string;
  manifestSource: string;
  metaSource: string;
}

export interface LivonClientSyncResult {
  status: 'updated' | 'unchanged' | 'cache';
  outputDirectory: string;
  clientFilePath: string;
  manifest: LivonContractManifest;
  meta: LivonContractMeta;
  warnings: readonly string[];
}

export interface LivonClientSyncError {
  code: string;
  message: string;
  cause?: unknown;
}

export interface LivonClientSyncLogger {
  warn?: LivonClientSyncLog;
  info?: LivonClientSyncLog;
  error?: LivonClientSyncLog;
}

export interface LivonClientSyncLog {
  (message: string): void;
}
