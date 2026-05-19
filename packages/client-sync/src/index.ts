import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pack, unpack } from 'msgpackr';
import WebSocket, { type RawData } from 'ws';

import {
  DEFAULT_FAILURE_MODE,
  DEFAULT_IMPORT_IDENTIFIER,
  DEFAULT_OUTPUT_DIRECTORY,
  DEFAULT_SYNC_MODE,
  DEFAULT_TIMEOUT_MILLISECONDS,
  DEFAULT_WATCH_POLL_INTERVAL_MILLISECONDS,
  type LivonClientSyncConfig,
  type LivonClientSyncLogger,
  type LivonClientSyncPluginConfig,
  type LivonClientSyncResult,
  type LivonContractManifest,
  type LivonContractMeta,
  type LivonFailureMode,
  type LivonRemoteFunctionDefinition,
  type LivonSubscriptionDefinition,
  type LivonTypeDefinition,
} from '@livon/contract';

export interface AstNode {
  type: string;
  name?: string;
  doc?: Readonly<Record<string, unknown>>;
  request?: string;
  response?: string;
  dependsOn?: string;
  constraints?: Readonly<Record<string, unknown>>;
  children?: readonly AstNode[];
}

export interface NormalizedLivonClientSyncConfig {
  url: string;
  outputDirectory: string;
  importIdentifier: string;
  syncMode: 'startup' | 'build' | 'watch' | 'manual';
  failureMode: LivonFailureMode;
  projectRoot: string;
  requestHeaders: Record<string, string>;
  timeoutMilliseconds: number;
  watchPollIntervalMilliseconds: number;
}

export interface ExplainPayload {
  ast: AstNode;
  checksum: string;
  schemaVersion?: string;
  generatedAt?: string;
  etag?: string;
  notModified?: boolean;
}

interface FetchExplainInput {
  config: NormalizedLivonClientSyncConfig;
  ifNoneMatch?: string;
}

interface GenerateArtifactsInput {
  ast: AstNode;
  config: NormalizedLivonClientSyncConfig;
  meta: LivonContractMeta;
}

interface RenderFunctionExportInput {
  definition: LivonRemoteFunctionDefinition;
  meta: LivonContractMeta;
  config: NormalizedLivonClientSyncConfig;
}

interface RenderDeclarationSourceInput {
  context: RenderContext;
  meta: LivonContractMeta;
}

interface GeneratedArtifacts {
  clientSource: string;
  clientDeclarationSource: string;
  manifest: LivonContractManifest;
  manifestSource: string;
  metaSource: string;
}

interface OutputPaths {
  outputDirectory: string;
  clientFilePath: string;
  clientDeclarationFilePath: string;
  manifestFilePath: string;
  metaFilePath: string;
}

interface RenderContext {
  types: Map<string, string>;
  typeDefinitions: string[];
  remoteFunctions: LivonRemoteFunctionDefinition[];
  subscriptions: LivonSubscriptionDefinition[];
  typeManifest: LivonTypeDefinition[];
}

interface NamedNode {
  name: string;
  node: AstNode;
}

interface FieldRenderInput {
  fieldNode: AstNode;
  context: RenderContext;
}

interface TypeRenderInput {
  node: AstNode | undefined;
  context: RenderContext;
}

interface WriteArtifactsInput {
  artifacts: GeneratedArtifacts;
  paths: OutputPaths;
}

interface CacheResultInput {
  paths: OutputPaths;
  warnings: readonly string[];
}

interface CreateSyncResultInput {
  status: 'updated' | 'unchanged' | 'cache';
  paths: OutputPaths;
  manifest: LivonContractManifest;
  meta: LivonContractMeta;
  warnings: readonly string[];
}

interface HandleSyncFailureInput {
  error: unknown;
  config: NormalizedLivonClientSyncConfig;
  paths: OutputPaths;
  logger?: LivonClientSyncLogger;
}

interface StartLivonClientSyncWatcherInput {
  config: LivonClientSyncConfig;
  logger?: LivonClientSyncLogger;
}

export interface ResolveLivonGeneratedClientPathInput {
  config: LivonClientSyncPluginConfig;
  projectRoot?: string;
}

export interface SyncLivonClientInput {
  config: LivonClientSyncConfig;
  logger?: LivonClientSyncLogger;
}

export interface LivonClientSyncWatcher {
  stop: LivonClientSyncWatcherStop;
}

export interface LivonClientSyncWatcherStop {
  (): void;
}

const CLIENT_GENERATION_REMOVED_MESSAGE =
  'Livon client generation through CLI has been removed. Configure a Livon build plugin instead.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isAstNode = (value: unknown): value is AstNode =>
  isRecord(value) && typeof value.type === 'string';

const walkAst = (node: AstNode, visit: (node: AstNode) => void): void => {
  visit(node);
  node.children?.forEach((child) => walkAst(child, visit));
};

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
};

const hashText = (value: string): string =>
  createHash('sha256').update(value).digest('hex');

const normalizeEndpointUrl = (url: string): string => {
  const trimmed = url.trim();
  if (!trimmed.startsWith('ws://') && !trimmed.startsWith('wss://')) {
    throw new Error('Livon client sync URL must be a ws:// or wss:// $explain endpoint.');
  }
  return trimmed;
};

export const normalizeLivonClientSyncConfig = ({
  url,
  outputDirectory = DEFAULT_OUTPUT_DIRECTORY,
  importIdentifier = DEFAULT_IMPORT_IDENTIFIER,
  syncMode = DEFAULT_SYNC_MODE,
  failureMode = DEFAULT_FAILURE_MODE,
  projectRoot = process.cwd(),
  requestHeaders = {},
  timeoutMilliseconds = DEFAULT_TIMEOUT_MILLISECONDS,
  watchPollIntervalMilliseconds = DEFAULT_WATCH_POLL_INTERVAL_MILLISECONDS,
}: LivonClientSyncConfig): NormalizedLivonClientSyncConfig => ({
  url: normalizeEndpointUrl(url),
  outputDirectory,
  importIdentifier,
  syncMode,
  failureMode,
  projectRoot,
  requestHeaders,
  timeoutMilliseconds,
  watchPollIntervalMilliseconds,
});

export const resolveLivonGeneratedClientPath = ({
  config,
  projectRoot = process.cwd(),
}: ResolveLivonGeneratedClientPathInput): string => {
  const normalized = normalizeLivonClientSyncConfig({ ...config, projectRoot });
  return path.join(projectRoot, normalized.outputDirectory, 'client.ts');
};

const resolveOutputPaths = (config: NormalizedLivonClientSyncConfig): OutputPaths => {
  const outputDirectory = path.resolve(config.projectRoot, config.outputDirectory);
  return {
    outputDirectory,
    clientFilePath: path.join(outputDirectory, 'client.ts'),
    clientDeclarationFilePath: path.join(outputDirectory, 'client.d.ts'),
    manifestFilePath: path.join(outputDirectory, 'manifest.json'),
    metaFilePath: path.join(outputDirectory, 'meta.json'),
  };
};

const binaryFromSocketData = (data: RawData): Uint8Array => {
  if (data instanceof Uint8Array) {
    return data;
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Array.isArray(data)) {
    return Buffer.concat(data);
  }
  throw new Error('Unsupported Livon $explain WebSocket payload.');
};

const buildExplainEnvelope = (ifNoneMatch?: string) => ({
  id: randomUUID(),
  event: '$explain',
  status: 'sending',
  metadata: ifNoneMatch ? { ifNoneMatch } : undefined,
  payload: pack(null),
});

const readExplainResponse = (value: unknown): ExplainPayload => {
  if (!isRecord(value) || !isAstNode(value.ast) || typeof value.checksum !== 'string') {
    throw new Error('Livon $explain response did not include a valid AST and checksum.');
  }
  return {
    ast: value.ast,
    checksum: value.checksum,
    schemaVersion: typeof value.schemaVersion === 'string' ? value.schemaVersion : undefined,
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : undefined,
    etag: typeof value.etag === 'string' ? value.etag : undefined,
    notModified: value.notModified === true,
  };
};

const fetchExplain = async ({ config, ifNoneMatch }: FetchExplainInput): Promise<ExplainPayload> => {
  return new Promise<ExplainPayload>((resolve, reject) => {
    const socket = new WebSocket(config.url, { headers: config.requestHeaders });
    let settled = false;
    const timeout = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      socket.close();
      reject(new Error('Timed out while fetching Livon $explain metadata.'));
    }, config.timeoutMilliseconds);
    const finish = (payload: ExplainPayload) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.close();
      resolve(payload);
    };
    const fail = (error: unknown) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      socket.close();
      reject(error);
    };
    socket.on('open', () => {
      socket.send(pack(buildExplainEnvelope(ifNoneMatch)));
    });
    socket.on('error', fail);
    socket.on('message', (data) => {
      const decoded = unpack(binaryFromSocketData(data));
      const payload = isRecord(decoded) && decoded.payload instanceof Uint8Array
        ? unpack(decoded.payload)
        : decoded;
      finish(readExplainResponse(payload));
    });
  });
};

const readLocalMeta = async (paths: OutputPaths): Promise<LivonContractMeta | undefined> => {
  const raw = await fs.readFile(paths.metaFilePath, 'utf8').catch(() => undefined);
  if (!raw) {
    return undefined;
  }
  const value = JSON.parse(raw) as unknown;
  if (!isRecord(value) || typeof value.contractHash !== 'string') {
    return undefined;
  }
  return value as unknown as LivonContractMeta;
};

const readLocalManifest = async (paths: OutputPaths): Promise<LivonContractManifest | undefined> => {
  const raw = await fs.readFile(paths.manifestFilePath, 'utf8').catch(() => undefined);
  if (!raw) {
    return undefined;
  }
  return JSON.parse(raw) as LivonContractManifest;
};

const hasGeneratedCache = async (paths: OutputPaths): Promise<boolean> => {
  const checks = await Promise.all([
    fs.access(paths.clientFilePath).then(() => true).catch(() => false),
    fs.access(paths.clientDeclarationFilePath).then(() => true).catch(() => false),
    fs.access(paths.manifestFilePath).then(() => true).catch(() => false),
    fs.access(paths.metaFilePath).then(() => true).catch(() => false),
  ]);
  return checks.every(Boolean);
};

const pascalCaseName = (value: string): string => {
  const cleaned = value.replace(/[^A-Za-z0-9]+(.)/g, (_match, group: string) => group.toUpperCase()).replace(/[^A-Za-z0-9_$]/g, '');
  const fallback = cleaned.length > 0 ? cleaned : 'LivonType';
  return /^[A-Za-z_$]/.test(fallback)
    ? `${fallback.charAt(0).toUpperCase()}${fallback.slice(1)}`
    : `Livon${fallback}`;
};

const camelCaseName = (value: string): string => {
  const pascal = pascalCaseName(value);
  return `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}`;
};

const quoteProperty = (value: string): string =>
  /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);

const collectNamedNodes = (ast: AstNode): NamedNode[] => {
  const byName = new Map<string, NamedNode>();
  walkAst(ast, (node) => {
    if (!node.name || node.type === 'api' || node.type === 'api-composed' || node.type === 'operation' || node.type === 'subscription' || node.type === 'field') {
      return;
    }
    if (!byName.has(node.name)) {
      byName.set(node.name, { name: node.name, node });
    }
  });
  return [...byName.values()];
};

const renderTypeReference = ({ node, context }: TypeRenderInput): string => {
  if (!node) {
    return 'void';
  }
  if (node.name && context.types.has(node.name)) {
    return context.types.get(node.name) ?? 'unknown';
  }
  if (node.type === 'array') {
    return `readonly ${renderTypeReference({ node: node.children?.[0], context })}[]`;
  }
  if (node.type === 'tuple') {
    return `[${(node.children ?? []).map((child) => renderTypeReference({ node: child, context })).join(', ')}]`;
  }
  if (node.type === 'and') {
    return (node.children ?? []).map((child) => renderTypeReference({ node: child, context })).join(' & ') || 'unknown';
  }
  if (node.type === 'string') {
    return 'string';
  }
  if (node.type === 'number') {
    return 'number';
  }
  if (node.type === 'boolean') {
    return 'boolean';
  }
  if (node.type === 'date') {
    return 'Date';
  }
  if (node.type === 'binary') {
    return 'Uint8Array';
  }
  if (node.type === 'literal') {
    const literalValue = node.constraints?.value;
    return typeof literalValue === 'string' || typeof literalValue === 'number' || typeof literalValue === 'boolean'
      ? JSON.stringify(literalValue)
      : 'unknown';
  }
  if (node.type === 'enum' && Array.isArray(node.constraints?.values)) {
    const values = node.constraints.values.filter((value) => typeof value === 'string');
    return values.length > 0 ? values.map((value) => JSON.stringify(value)).join(' | ') : 'string';
  }
  if (node.type === 'object') {
    return `{ ${(node.children ?? []).map((child) => renderField({ fieldNode: child, context })).filter(Boolean).join(' ')} }`;
  }
  return 'unknown';
};

const renderField = ({ fieldNode, context }: FieldRenderInput): string => {
  if (fieldNode.type !== 'field' || !fieldNode.name) {
    return '';
  }
  return `${quoteProperty(fieldNode.name)}: ${renderTypeReference({ node: fieldNode.children?.[0], context })};`;
};

const renderNamedType = (node: AstNode, context: RenderContext): string => {
  const typeName = node.name ? context.types.get(node.name) : undefined;
  if (!typeName) {
    return '';
  }
  if (node.type === 'object') {
    return `export interface ${typeName} {\n${(node.children ?? []).map((child) => `  ${renderField({ fieldNode: child, context })}`).filter((line) => line.trim().length > 0).join('\n')}\n}`;
  }
  return `export type ${typeName} = ${renderTypeReference({ node: { ...node, name: undefined }, context })};`;
};

const createRenderContext = (ast: AstNode): RenderContext => {
  const namedNodes = collectNamedNodes(ast);
  const types = new Map<string, string>();
  namedNodes.forEach(({ name }) => {
    types.set(name, pascalCaseName(name));
  });
  const context: RenderContext = {
    types,
    typeDefinitions: [],
    remoteFunctions: [],
    subscriptions: [],
    typeManifest: namedNodes.map(({ name, node }) => ({ name, kind: node.type })),
  };
  context.typeDefinitions = namedNodes.map(({ node }) => renderNamedType(node, context)).filter(Boolean);
  return context;
};

const collectApiDefinitions = (ast: AstNode, context: RenderContext): RenderContext => {
  walkAst(ast, (node) => {
    if (node.type === 'operation' && node.name) {
      const inputNode = node.children?.[0];
      const responseNode = node.children?.[1];
      const inputTypeName = renderTypeReference({ node: inputNode, context });
      const responseTypeName = renderTypeReference({ node: responseNode, context });
      context.remoteFunctions.push({
        name: node.name,
        exportName: camelCaseName(node.name),
        remoteIdentifier: node.name,
        inputTypeName,
        responseTypeName,
      });
    }
    if (node.type === 'subscription' && node.name) {
      const payloadNode = node.children?.[0];
      context.subscriptions.push({
        name: node.name,
        payloadTypeName: renderTypeReference({ node: payloadNode, context }),
        inputTypeName: typeof node.constraints?.input === 'string' ? node.constraints.input : undefined,
        responseTypeName: typeof node.constraints?.response === 'string' ? node.constraints.response : undefined,
      });
    }
  });
  return context;
};

const renderFunctionInterface = (definition: LivonRemoteFunctionDefinition): string =>
  `export interface ${pascalCaseName(`${definition.name}Function`)} {\n  (input: ${definition.inputTypeName ?? 'void'}): Promise<${definition.responseTypeName ?? 'void'}>;\n}`;

const renderFunctionExport = ({ definition, meta, config }: RenderFunctionExportInput): string =>
  `export const ${definition.exportName}: ${pascalCaseName(`${definition.name}Function`)} = createLivonRemoteFunction({\n  endpointUrl: ${JSON.stringify(config.url)},\n  remoteIdentifier: ${JSON.stringify(definition.remoteIdentifier)},\n  contractVersion: ${JSON.stringify(meta.contractVersion)},\n});`;

const renderSubscriptionTypes = (subscriptions: readonly LivonSubscriptionDefinition[]): string[] => {
  const eventMap = [
    'export interface LivonSubscriptionMap {',
    ...subscriptions.map((subscription) => `  ${quoteProperty(subscription.name)}: ${subscription.payloadTypeName ?? 'unknown'};`),
    '}',
  ].join('\n');
  const handlers = [
    'export interface LivonSubscriptionHandlers {',
    ...subscriptions.map((subscription) => `  ${quoteProperty(subscription.name)}?: LivonSubscriptionHandler<${subscription.payloadTypeName ?? 'unknown'}>;`),
    '}',
  ].join('\n');
  return [eventMap, handlers];
};

const renderSubscriptionRegistration = (subscriptions: readonly LivonSubscriptionDefinition[]): string => {
  const registrations = subscriptions.map((subscription) => {
    const key = quoteProperty(subscription.name);
    return `  if (handlers.${key}) {\n    subscriptions.push(registerLivonSubscription({ remoteIdentifier: ${JSON.stringify(subscription.name)}, handler: handlers.${key} }).unsubscribe);\n  }`;
  }).join('\n');
  return `export const registerLivonSubscriptionHandlers = (handlers: LivonSubscriptionHandlers): LivonUnsubscribe => {\n  const subscriptions: LivonUnsubscribe[] = [];\n${registrations}\n  return () => subscriptions.forEach((unsubscribe) => unsubscribe());\n};`;
};

const renderApiObject = (context: RenderContext): string => {
  const operationEntries = context.remoteFunctions.map((definition) => `  ${definition.exportName},`).join('\n');
  return `export interface LivonGeneratedApi {\n  (handlers: LivonSubscriptionHandlers): LivonUnsubscribe;\n${context.remoteFunctions.map((definition) => `  ${definition.exportName}: ${pascalCaseName(`${definition.name}Function`)};`).join('\n')}\n}\n\nexport const api = Object.assign(\n  (handlers: LivonSubscriptionHandlers) => registerLivonSubscriptionHandlers(handlers),\n  {\n${operationEntries}\n  },\n) as LivonGeneratedApi;`;
};

const renderDeclarationSource = ({ context, meta }: RenderDeclarationSourceInput): string => [
  "import type { LivonSubscriptionHandler, LivonUnsubscribe } from '@livon/client';",
  '',
  `export declare const LIVON_CONTRACT_HASH: ${JSON.stringify(meta.contractHash)};`,
  `export declare const LIVON_CONTRACT_VERSION: ${JSON.stringify(meta.contractVersion)};`,
  '',
  ...context.typeDefinitions,
  '',
  ...context.remoteFunctions.map(renderFunctionInterface),
  '',
  ...renderSubscriptionTypes(context.subscriptions),
  '',
  ...context.remoteFunctions.map(
    (definition) =>
      `export declare const ${definition.exportName}: ${pascalCaseName(`${definition.name}Function`)};`,
  ),
  '',
  'export declare const registerLivonSubscriptionHandlers: (handlers: LivonSubscriptionHandlers) => LivonUnsubscribe;',
  '',
  `export interface LivonGeneratedApi {\n  (handlers: LivonSubscriptionHandlers): LivonUnsubscribe;\n${context.remoteFunctions.map((definition) => `  ${definition.exportName}: ${pascalCaseName(`${definition.name}Function`)};`).join('\n')}\n}`,
  '',
  'export declare const api: LivonGeneratedApi;',
  '',
].join('\n');

const generateArtifacts = ({ ast, config, meta }: GenerateArtifactsInput): GeneratedArtifacts => {
  const context = collectApiDefinitions(ast, createRenderContext(ast));
  const manifest: LivonContractManifest = {
    schemaVersion: meta.schemaVersion,
    contractVersion: meta.contractVersion,
    contractHash: meta.contractHash,
    generatedAt: meta.generatedAt,
    endpointUrl: config.url,
    remoteFunctions: context.remoteFunctions,
    subscriptions: context.subscriptions,
    types: context.typeManifest,
  };
  const source = [
    "import { createLivonRemoteFunction, registerLivonSubscription } from '@livon/client';",
    "import type { LivonSubscriptionHandler, LivonUnsubscribe } from '@livon/client';",
    '',
    `export const LIVON_CONTRACT_HASH = ${JSON.stringify(meta.contractHash)};`,
    `export const LIVON_CONTRACT_VERSION = ${JSON.stringify(meta.contractVersion)};`,
    '',
    ...context.typeDefinitions,
    '',
    ...context.remoteFunctions.map(renderFunctionInterface),
    '',
    ...renderSubscriptionTypes(context.subscriptions),
    '',
    ...context.remoteFunctions.map((definition) => renderFunctionExport({ definition, meta, config })),
    '',
    renderSubscriptionRegistration(context.subscriptions),
    '',
    renderApiObject(context),
    '',
  ].join('\n');
  return {
    clientSource: source,
    clientDeclarationSource: renderDeclarationSource({ context, meta }),
    manifest,
    manifestSource: `${JSON.stringify(manifest, null, 2)}\n`,
    metaSource: `${JSON.stringify(meta, null, 2)}\n`,
  };
};

const writeArtifacts = async ({ artifacts, paths }: WriteArtifactsInput): Promise<void> => {
  await fs.mkdir(paths.outputDirectory, { recursive: true });
  await Promise.all([
    fs.writeFile(paths.clientFilePath, artifacts.clientSource, 'utf8'),
    fs.writeFile(paths.clientDeclarationFilePath, artifacts.clientDeclarationSource, 'utf8'),
    fs.writeFile(paths.manifestFilePath, artifacts.manifestSource, 'utf8'),
    fs.writeFile(paths.metaFilePath, artifacts.metaSource, 'utf8'),
  ]);
};

const createSyncResult = ({
  status,
  paths,
  manifest,
  meta,
  warnings,
}: CreateSyncResultInput): LivonClientSyncResult => ({
  status,
  outputDirectory: paths.outputDirectory,
  clientFilePath: paths.clientFilePath,
  manifest,
  meta,
  warnings,
});

const readCacheResult = async ({ paths, warnings }: CacheResultInput): Promise<LivonClientSyncResult> => {
  const [manifest, meta] = await Promise.all([readLocalManifest(paths), readLocalMeta(paths)]);
  if (!manifest || !meta) {
    throw new Error('Livon generated client cache is missing or incomplete.');
  }
  return createSyncResult({ status: 'cache', paths, manifest, meta, warnings });
};

const handleSyncFailure = async ({
  error,
  config,
  paths,
  logger,
}: HandleSyncFailureInput): Promise<LivonClientSyncResult> => {
  if (config.failureMode === 'error') {
    throw error;
  }
  const hasCache = await hasGeneratedCache(paths);
  if (!hasCache) {
    throw error;
  }
  const message = error instanceof Error ? error.message : 'Livon client sync failed.';
  if (config.failureMode === 'warnAndUseCache') {
    logger?.warn?.(`livon: ${message} Using generated client cache.`);
  }
  return readCacheResult({ paths, warnings: [message] });
};

export const syncLivonClient = async ({
  config: input,
  logger,
}: SyncLivonClientInput): Promise<LivonClientSyncResult> => {
  const config = normalizeLivonClientSyncConfig(input);
  const paths = resolveOutputPaths(config);
  try {
    const localMeta = await readLocalMeta(paths);
    const explain = await fetchExplain({ config, ifNoneMatch: localMeta?.contractHash });
    const contractHash = explain.checksum || hashText(stableStringify(explain.ast));
    const generatedAt = explain.generatedAt ?? new Date().toISOString();
    const meta: LivonContractMeta = {
      schemaVersion: explain.schemaVersion ?? '1',
      contractVersion: contractHash,
      contractHash,
      generatedAt,
    };
    if (localMeta?.contractHash === contractHash && await hasGeneratedCache(paths)) {
      const manifest = await readLocalManifest(paths);
      if (manifest) {
        return createSyncResult({ status: 'unchanged', paths, manifest, meta: localMeta, warnings: [] });
      }
    }
    const artifacts = generateArtifacts({ ast: explain.ast, config, meta });
    await writeArtifacts({ artifacts, paths });
    logger?.info?.(`livon: generated client synced to ${paths.outputDirectory}`);
    return createSyncResult({ status: 'updated', paths, manifest: artifacts.manifest, meta, warnings: [] });
  } catch (error) {
    return handleSyncFailure({ error, config, paths, logger });
  }
};

export const startLivonClientSyncWatcher = ({ config, logger }: StartLivonClientSyncWatcherInput): LivonClientSyncWatcher => {
  const normalized = normalizeLivonClientSyncConfig(config);
  let stopped = false;
  const sync = () => {
    if (stopped) {
      return;
    }
    void syncLivonClient({ config: normalized, logger }).finally(() => {
      if (!stopped) {
        setTimeout(sync, normalized.watchPollIntervalMilliseconds);
      }
    });
  };
  void syncLivonClient({ config: normalized, logger }).finally(() => {
    if (!stopped) {
      setTimeout(sync, normalized.watchPollIntervalMilliseconds);
    }
  });
  return {
    stop: () => {
      stopped = true;
    },
  };
};

export { CLIENT_GENERATION_REMOVED_MESSAGE };
