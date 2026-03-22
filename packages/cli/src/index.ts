import { generateClientFiles, getClientGeneratorFingerprint } from '@livon/client/generate';
import type { AstNode } from '@livon/client/generate';
import { createRslib } from '@rslib/core';
import { spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import WebSocket, { type RawData } from 'ws';
import { pack, unpack } from 'msgpackr';

interface Options {
  endpoint: string;
  port?: number;
  out: string;
  poll?: number;
  timeout?: number;
  event?: string;
  method?: 'GET' | 'POST';
  headers: Record<string, string>;
  payload?: unknown;
  build: BuildOptions;
}

type BuildFormat = 'esm' | 'cjs';

interface BuildOptions {
  dts: boolean;
  formats: readonly BuildFormat[];
  customFormats: boolean;
}

interface ExplainResponse {
  ast: unknown;
  checksum?: string;
  schemaVersion?: string;
  generatedAt?: string | number;
}

interface FetchResult {
  ast?: unknown;
  checksum?: string;
  schemaVersion?: string;
  generatedAt?: string | number;
  etag?: string;
  notModified?: boolean;
}

interface CachedClientChecksum {
  generatorHash?: string;
  etag?: string;
}

interface GeneratedClientSummary {
  subscriptions: number;
  fieldResolvers: number;
  inputs: number;
  outputs: number;
}

interface BuildGeneratedClientInput {
  options: Options;
}

interface BuildGeneratedClientResult {
  dts: boolean;
  formats: readonly BuildFormat[];
  outputPath: string;
}

interface GeneratedPackageManifest {
  type: 'module';
  sideEffects: boolean;
  main?: string;
  module?: string;
  types?: string;
  exports: {
    '.': {
      types?: string;
      import?: string;
      require?: string;
      default: string;
    };
  };
}

interface WireEnvelopeBase {
  id: string;
  event: string;
  status: 'sending' | 'receiving' | 'failed';
  metadata?: Readonly<Record<string, unknown>>;
  context?: Uint8Array;
}

interface WireEnvelopePayload extends WireEnvelopeBase {
  payload: Uint8Array;
  error?: never;
}

interface BuildWireEnvelopeInput {
  event: string;
  payload: unknown;
  metadata?: Readonly<Record<string, unknown>>;
  context?: Record<string, unknown>;
}

interface ParsedEnvelope {
  event?: string;
  payload?: Uint8Array;
  metadata?: Readonly<Record<string, unknown>>;
  context?: Uint8Array;
  error?: Uint8Array;
}

interface ExplainResponsePayload extends ExplainResponse {
  notModified?: boolean;
  etag?: string;
}

type WebSocketData = RawData | ArrayBufferView;

const RETRY_RESET_AFTER_CONNECTION = 'livon.retry.reset_after_connection';
const BUILD_FORMATS = ['esm', 'cjs'] as const;

interface RetryAwareError extends Error {
  [RETRY_RESET_AFTER_CONNECTION]?: boolean;
}

interface ParsedCliInput {
  options: Options;
  command: string[];
}

interface ReadOptionValueInput {
  argv: string[];
  index: number;
  arg: string;
}

interface ReadOptionValueResult {
  nextIndex: number;
  value?: string;
}

interface ReadCliArgsInput {
  argv: string[];
  index: number;
  options: Options;
}

interface ReadCliArgsResult {
  command: string[];
  options: Options;
}

interface AddBuildFormatInput {
  options: Options;
  format: BuildFormat;
}

const addBuildFormat = ({ options, format }: AddBuildFormatInput): Options => {
  const nextFormats = options.build.customFormats
    ? [...new Set([...options.build.formats, format])]
    : [format];
  return {
    ...options,
    build: {
      ...options.build,
      formats: nextFormats,
      customFormats: true,
    },
  };
};

const createDefaultOptions = (): Options => ({
  endpoint: '',
  port: undefined,
  out: '',
  poll: undefined,
  timeout: undefined,
  event: '$explain',
  method: 'POST',
  headers: {},
  payload: undefined,
  build: {
    dts: true,
    formats: BUILD_FORMATS,
    customFormats: false,
  },
});

const readOptionValue = ({ argv, index, arg }: ReadOptionValueInput): ReadOptionValueResult => {
  if (arg.includes('=')) {
    return { nextIndex: index + 1, value: arg.split('=').slice(1).join('=') };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('-')) {
    return { nextIndex: index + 1, value: undefined };
  }
  return { nextIndex: index + 2, value };
};

const readCliArgs = ({ argv, index, options }: ReadCliArgsInput): ReadCliArgsResult => {
  const arg = argv[index];
  if (!arg) {
    return { options, command: [] };
  }

  if (arg === '--') {
    return { options, command: argv.slice(index + 1) };
  }

  if (!arg.startsWith('-')) {
    return { options, command: argv.slice(index) };
  }

  if (arg === '--no-event') {
    return readCliArgs({
      argv,
      index: index + 1,
      options: {
        ...options,
        event: undefined,
        method: 'GET',
      },
    });
  }

  if (arg === '--js') {
    return readCliArgs({
      argv,
      index: index + 1,
      options: {
        ...options,
        build: {
          ...options.build,
          dts: false,
        },
      },
    });
  }

  if (arg === '--esm') {
    return readCliArgs({
      argv,
      index: index + 1,
      options: addBuildFormat({ options, format: 'esm' }),
    });
  }

  if (arg === '--cjs') {
    return readCliArgs({
      argv,
      index: index + 1,
      options: addBuildFormat({ options, format: 'cjs' }),
    });
  }

  if (arg.startsWith('--endpoint')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    return readCliArgs({
      argv,
      index: nextIndex,
      options: { ...options, endpoint: value ?? '' },
    });
  }

  if (arg.startsWith('--out')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    return readCliArgs({
      argv,
      index: nextIndex,
      options: { ...options, out: value ?? '' },
    });
  }

  if (arg.startsWith('--poll')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    return readCliArgs({
      argv,
      index: nextIndex,
      options: {
        ...options,
        poll: value ? Number(value) : undefined,
      },
    });
  }

  if (arg.startsWith('--timeout')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    if (value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --timeout value: ${value}`);
      }
      return readCliArgs({
        argv,
        index: nextIndex,
        options: {
          ...options,
          timeout: parsed,
        },
      });
    }
    return readCliArgs({ argv, index: nextIndex, options });
  }

  if (arg.startsWith('--port')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    if (value) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid --port value: ${value}`);
      }
      return readCliArgs({
        argv,
        index: nextIndex,
        options: {
          ...options,
          port: parsed,
        },
      });
    }
    return readCliArgs({ argv, index: nextIndex, options });
  }

  if (arg.startsWith('--event')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    return readCliArgs({
      argv,
      index: nextIndex,
      options: {
        ...options,
        event: value,
        method: 'POST',
      },
    });
  }

  if (arg.startsWith('--method')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    return readCliArgs({
      argv,
      index: nextIndex,
      options: {
        ...options,
        method: value && value.toUpperCase() === 'GET' ? 'GET' : 'POST',
      },
    });
  }

  if (arg.startsWith('--header')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    if (value) {
      const [key, ...rest] = value.split(':');
      if (key && rest.length > 0) {
        return readCliArgs({
          argv,
          index: nextIndex,
          options: {
            ...options,
            headers: {
              ...options.headers,
              [key.trim()]: rest.join(':').trim(),
            },
          },
        });
      }
    }
    return readCliArgs({ argv, index: nextIndex, options });
  }

  if (arg.startsWith('--payload')) {
    const { value, nextIndex } = readOptionValue({ argv, index, arg });
    if (value) {
      try {
        return readCliArgs({
          argv,
          index: nextIndex,
          options: {
            ...options,
            payload: JSON.parse(value),
          },
        });
      } catch (error) {
        throw new Error(`Invalid JSON for --payload: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    return readCliArgs({ argv, index: nextIndex, options });
  }

  return readCliArgs({ argv, index: index + 1, options });
};

const readCliInput = (argv: string[]): ParsedCliInput => {
  const parsed = readCliArgs({
    argv,
    index: 0,
    options: createDefaultOptions(),
  });
  const options: Options = {
    ...parsed.options,
  };

  if (!options.endpoint && options.port) {
    options.endpoint = `ws://127.0.0.1:${options.port}/ws`;
  }
  if (!options.endpoint) {
    throw new Error('Missing required --endpoint or --port');
  }
  if (options.port) {
    options.endpoint = applyPortToEndpoint(options.endpoint, options.port);
  }
  if (!options.out) {
    throw new Error('Missing required --out');
  }
  if (options.event === undefined) {
    throw new Error('Missing required --event for websocket mode.');
  }

  return {
    options,
    command: parsed.command,
  };
};

const isConnectionRefusedError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes('ECONNREFUSED');
};

const applyPortToEndpoint = (endpoint: string, port: number): string => {
  const url = new URL(endpoint);
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error('Endpoint must be ws:// or wss:// for websocket mode.');
  }
  url.port = String(port);
  if (!url.pathname || url.pathname === '/') {
    url.pathname = '/ws';
  }
  return url.toString();
};

const hashAst = (ast: unknown): string =>
  createHash('sha256').update(JSON.stringify(ast)).digest('hex');

const summarizeGeneratedClient = (ast: AstNode): GeneratedClientSummary => {
  const getRequestType = (node: AstNode): string | undefined => {
    const requestFromNode = typeof node.request === 'string' ? node.request : undefined;
    if (requestFromNode) {
      return requestFromNode;
    }
    if (!isRecord(node.constraints)) {
      return undefined;
    }
    return typeof node.constraints.request === 'string' ? node.constraints.request : undefined;
  };

  const getResponseType = (node: AstNode): string | undefined => {
    const responseFromNode = typeof node.response === 'string' ? node.response : undefined;
    if (responseFromNode) {
      return responseFromNode;
    }
    if (!isRecord(node.constraints)) {
      return undefined;
    }
    return typeof node.constraints.response === 'string' ? node.constraints.response : undefined;
  };

  const isFieldResolverNode = (node: AstNode): boolean => {
    if (node.type !== 'field' || !isRecord(node.constraints)) {
      return false;
    }
    return typeof node.constraints.owner === 'string' && typeof node.constraints.field === 'string';
  };

  const walk = (node: AstNode): GeneratedClientSummary => {
    const own = {
      subscriptions: node.type === 'subscription' ? 1 : 0,
      fieldResolvers: isFieldResolverNode(node) ? 1 : 0,
      inputs:
        (node.type === 'operation' || node.type === 'subscription' || isFieldResolverNode(node))
        && getRequestType(node)
          ? 1
          : 0,
      outputs:
        (node.type === 'operation' || node.type === 'subscription' || isFieldResolverNode(node))
        && getResponseType(node)
          ? 1
          : 0,
    };

    return (node.children ?? []).reduce<GeneratedClientSummary>(
      (acc, child) => {
        const childSummary = walk(child);
        return {
          subscriptions: acc.subscriptions + childSummary.subscriptions,
          fieldResolvers: acc.fieldResolvers + childSummary.fieldResolvers,
          inputs: acc.inputs + childSummary.inputs,
          outputs: acc.outputs + childSummary.outputs,
        };
      },
      own,
    );
  };

  return walk(ast);
};

const compactMetadata = (
  metadata?: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> | undefined => {
  if (!metadata) {
    return undefined;
  }
  return Object.keys(metadata).length > 0 ? metadata : undefined;
};

const compactContext = (context?: Record<string, unknown>): Record<string, unknown> | undefined => {
  if (!context || Object.keys(context).length === 0) {
    return undefined;
  }
  return context;
};

const encodePayload = (value: unknown): Uint8Array => pack(value);

const decodePayload = (payload?: Uint8Array): unknown => (payload ? unpack(payload) : undefined);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const binaryFromSocketData = (data: WebSocketData): Uint8Array => {
  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data));
  }
  if (typeof data === 'string') {
    throw new Error('Expected binary WebSocket payload.');
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  if (Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (ArrayBuffer.isView(data)) {
    return new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  }
  return new Uint8Array(Buffer.from(data));
};

const ensureEvent = (value: string | undefined): string => {
  if (!value) {
    throw new Error('Missing required --event for websocket mode.');
  }
  return value;
};

const buildWireEnvelope = (input: BuildWireEnvelopeInput): WireEnvelopePayload => {
  const metadata = compactMetadata(input.metadata);
  const context = compactContext(input.context);
  const base: WireEnvelopeBase = {
    id: randomUUID(),
    event: input.event,
    status: 'sending',
    metadata,
    context: context ? encodePayload(context) : undefined,
  };
  return {
    ...base,
    payload: encodePayload(input.payload),
  };
};

const DEFAULT_TIMEOUT_MS = 30_000;
const CLIENT_GENERATOR_HASH = getClientGeneratorFingerprint();

const fetchAst = async (options: Options, etag?: string): Promise<FetchResult> => {
  const endpoint = options.endpoint.trim();
  if (!endpoint.startsWith('ws://') && !endpoint.startsWith('wss://')) {
    throw new Error('Endpoint must be ws:// or wss:// for $explain.');
  }

  return new Promise<FetchResult>((resolve, reject) => {
    const ws = new WebSocket(endpoint, {
      headers: options.headers,
    });
    let resolved = false;
    let hadConnection = false;
    const timeoutMs = options.timeout ?? DEFAULT_TIMEOUT_MS;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        reject(new Error('Timed out waiting for $explain response.'));
      }
    }, timeoutMs);

    const finish = (result: FetchResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      ws.close();
      resolve(result);
    };
    const fail = (error: Error) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      ws.close();
      const retryAware = error as RetryAwareError;
      if (hadConnection) {
        retryAware[RETRY_RESET_AFTER_CONNECTION] = true;
      }
      reject(error);
    };

    ws.on('error', (error: Error) => {
      fail(error);
    });

    ws.on('open', () => {
      hadConnection = true;
      const eventName = ensureEvent(options.event);
      const request = buildWireEnvelope({
        event: eventName,
        payload: options.payload ?? null,
        metadata: etag ? { ifNoneMatch: etag } : undefined,
      });
      ws.send(pack(request));
    });

    ws.on('message', (data: RawData) => {
      let parsed: unknown;
      try {
        parsed = unpack(binaryFromSocketData(data));
      } catch {
        return;
      }
      if (!isRecord(parsed)) {
        return;
      }
      const envelope = parsed as ParsedEnvelope;
      if (envelope.event && envelope.event !== options.event) {
        return;
      }
      if (envelope.error) {
        const decoded = decodePayload(envelope.error);
        const message =
          decoded && typeof decoded === 'object' && 'message' in decoded
            ? String((decoded as { message?: unknown }).message ?? 'Explain error')
            : 'Explain error';
        fail(new Error(message));
        return;
      }
      const payload = envelope.payload ? decodePayload(envelope.payload) : parsed;
      if (!payload || typeof payload !== 'object') {
        return;
      }

      const response = payload as ExplainResponsePayload;
      if (response.notModified) {
        finish({ notModified: true, etag: response.etag ?? etag });
        return;
      }
      if ('ast' in response) {
        finish({
          ast: response.ast,
          checksum: response.checksum,
          schemaVersion: response.schemaVersion,
          generatedAt: response.generatedAt,
          etag: response.etag ?? response.checksum ?? etag,
        });
      }
    });
  });
};

const resolveOutputPaths = (out: string) => {
  const absoluteOut = path.resolve(out);
  const isFile = path.extname(absoluteOut).length > 0;
  const outDir = isFile ? path.dirname(absoluteOut) : absoluteOut;
  const astFile = path.join(outDir, 'ast.ts');
  const clientFile = isFile ? absoluteOut : path.join(outDir, 'client.ts');
  const indexFile = path.join(outDir, 'index.ts');
  const packageJsonFile = path.join(outDir, 'package.json');
  const checksumFile = path.join(outDir, '.livon.client.checksum');
  return { outDir, astFile, clientFile, indexFile, packageJsonFile, checksumFile };
};

interface RelativeBuildPathInput {
  basePath: string;
  filePath: string;
}

const relativeBuildPath = ({ basePath, filePath }: RelativeBuildPathInput): string => {
  const relativePath = path.relative(basePath, filePath).split(path.sep).join('/');
  return `./${relativePath}`;
};

interface CreateBuildEntriesInput {
  outDir: string;
  indexFile: string;
  clientFile: string;
  astFile: string;
}

const createBuildEntries = ({
  outDir,
  indexFile,
  clientFile,
  astFile,
}: CreateBuildEntriesInput): Readonly<Record<string, string>> => {
  const files = [indexFile, clientFile, astFile];
  const entryNames = files.map((filePath) => path.parse(filePath).name);
  const uniqueEntryNames = new Set(entryNames);
  if (uniqueEntryNames.size !== entryNames.length) {
    throw new Error('Generated output file names must be unique for rslib entries.');
  }
  return files.reduce<Record<string, string>>((acc, filePath) => {
    return {
      ...acc,
      [path.parse(filePath).name]: relativeBuildPath({ basePath: outDir, filePath }),
    };
  }, {});
};

interface ToManifestOutputFileInput {
  format: BuildFormat;
}

const manifestOutputFile = ({ format }: ToManifestOutputFileInput): string =>
  format === 'esm' ? './dist/index.js' : './dist/index.cjs';

interface CreateGeneratedPackageManifestInput {
  buildResult: BuildGeneratedClientResult;
}

const createGeneratedPackageManifest = ({
  buildResult,
}: CreateGeneratedPackageManifestInput): GeneratedPackageManifest => {
  const hasEsm = buildResult.formats.includes('esm');
  const hasCjs = buildResult.formats.includes('cjs');
  const defaultFormat: BuildFormat = hasEsm ? 'esm' : 'cjs';
  const main = hasCjs ? manifestOutputFile({ format: 'cjs' }) : undefined;
  const module = hasEsm ? manifestOutputFile({ format: 'esm' }) : undefined;
  const types = buildResult.dts ? './dist/index.d.ts' : undefined;
  return {
    type: 'module',
    sideEffects: false,
    ...(main ? { main } : {}),
    ...(module ? { module } : {}),
    ...(types ? { types } : {}),
    exports: {
      '.': {
        ...(types ? { types } : {}),
        ...(hasEsm ? { import: manifestOutputFile({ format: 'esm' }) } : {}),
        ...(hasCjs ? { require: manifestOutputFile({ format: 'cjs' }) } : {}),
        default: manifestOutputFile({ format: defaultFormat }),
      },
    },
  };
};

interface WriteGeneratedPackageManifestInput {
  packageJsonFile: string;
  buildResult: BuildGeneratedClientResult;
}

const writeGeneratedPackageManifest = async ({
  packageJsonFile,
  buildResult,
}: WriteGeneratedPackageManifestInput): Promise<void> => {
  const manifest = createGeneratedPackageManifest({ buildResult });
  await fs.writeFile(
    packageJsonFile,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
};

const buildGeneratedClient = async ({ options }: BuildGeneratedClientInput): Promise<BuildGeneratedClientResult> => {
  if (options.build.formats.length === 0) {
    throw new Error('Build formats cannot be empty.');
  }

  const { outDir, astFile, clientFile, indexFile, packageJsonFile } = resolveOutputPaths(options.out);
  const entries = createBuildEntries({
    outDir,
    indexFile,
    clientFile,
    astFile,
  });
  const buildResult: BuildGeneratedClientResult = {
    dts: options.build.dts,
    formats: options.build.formats,
    outputPath: path.join(outDir, 'dist'),
  };
  await fs.mkdir(outDir, { recursive: true });
  await writeGeneratedPackageManifest({
    packageJsonFile,
    buildResult,
  });
  const rslib = await createRslib({
    cwd: outDir,
    config: {
      source: {
        entry: entries,
      },
      lib: options.build.formats.map((format) => {
        return {
          format,
          syntax: 'es2021',
          dts: options.build.dts,
          bundle: false,
        };
      }),
      output: {
        target: 'web',
        distPath: 'dist',
        cleanDistPath: true,
        minify: false,
      },
    },
  });

  await rslib.build();
  return buildResult;
};

const readCachedChecksum = async (checksumFile: string): Promise<CachedClientChecksum> => {
  const raw = (await fs.readFile(checksumFile, 'utf8').catch(() => '')).trim();
  if (!raw) {
    return {};
  }

  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const generatorHash = typeof parsed.generatorHash === 'string' ? parsed.generatorHash : undefined;
      const etag = typeof parsed.etag === 'string' ? parsed.etag : undefined;
      return { generatorHash, etag };
    } catch {}
  }

  const legacyVersionSeparator = raw.indexOf(':');
  if (raw.startsWith('client-generator-') && legacyVersionSeparator > 0) {
    const etag = raw.slice(legacyVersionSeparator + 1).trim();
    return { etag: etag || undefined };
  }

  return { etag: raw };
};

const writeClientFiles = async (
  ast: unknown,
  options: Options,
  meta?: Pick<FetchResult, 'checksum' | 'etag' | 'schemaVersion' | 'generatedAt'>,
  config?: { forceWrite?: boolean },
) => {
  const { outDir, astFile, clientFile, indexFile, checksumFile } = resolveOutputPaths(options.out);
  await fs.mkdir(outDir, { recursive: true });
  const previous = await readCachedChecksum(checksumFile);
  const checksum = meta?.checksum ?? hashAst(ast);
  const etagBase = (meta?.etag ?? checksum).trim();
  const hasSameGenerator = previous.generatorHash === CLIENT_GENERATOR_HASH;
  const hasSameEtag = previous.etag === etagBase;
  const shouldForceWrite = Boolean(config?.forceWrite);

  if (!shouldForceWrite && hasSameGenerator && hasSameEtag) {
    return {
      updated: false,
      checksum,
      etag: etagBase,
      schemaVersion: meta?.schemaVersion,
      generatedAt: meta?.generatedAt,
    };
  }

  const astNode = ast as AstNode;
  const generated = generateClientFiles({ ast: astNode });
  const astSource = generated.files[generated.astFile];
  const clientSource = generated.files[generated.clientFile];

  if (!astSource || !clientSource) {
    throw new Error('Generated client sources were empty.');
  }
  const summary = summarizeGeneratedClient(astNode);

  await fs.writeFile(astFile, astSource, 'utf8');
  await fs.writeFile(clientFile, clientSource, 'utf8');
  const astModuleName = path.parse(generated.astFile).name;
  const clientModuleName = path.parse(generated.clientFile).name;
  const indexSource = [
    `export { ast } from './${astModuleName}.js';`,
    `export { api, createApiClient } from './${clientModuleName}.js';`,
    `export * from './${clientModuleName}.js';`,
    '',
  ].join('\n');
  await fs.writeFile(indexFile, indexSource, 'utf8');
  await fs.writeFile(
    checksumFile,
    JSON.stringify({ generatorHash: CLIENT_GENERATOR_HASH, etag: etagBase }),
    'utf8',
  );
  return {
    updated: true,
    summary,
    checksum,
    etag: etagBase,
    schemaVersion: meta?.schemaVersion,
    generatedAt: meta?.generatedAt,
  };
};

interface CommandRuntime {
  waitForExit: Promise<number>;
}

interface StartCommandRuntimeInput {
  command: string[];
}

const startCommandRuntime = ({ command }: StartCommandRuntimeInput): CommandRuntime => {
  const [commandName, ...commandArgs] = command;
  if (!commandName) {
    throw new Error('Missing command to run after livon sync.');
  }

  const child = spawn(commandName, commandArgs, {
    stdio: 'inherit',
    env: process.env,
  });

  const stopChild = () => {
    if (child.killed) {
      return;
    }
    child.kill('SIGTERM');
  };

  process.on('exit', stopChild);
  process.on('SIGINT', () => {
    stopChild();
    process.exit(130);
  });
  process.on('SIGTERM', () => {
    stopChild();
    process.exit(143);
  });

  const waitForExit = new Promise<number>((resolve, reject) => {
    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      const exitCode = typeof code === 'number' ? code : signal ? 1 : 0;
      if (exitCode !== 0) {
        // eslint-disable-next-line no-console
        console.error(`livon: linked command exited with code ${exitCode}`);
      }
      resolve(exitCode);
      process.exit(exitCode);
    });
  });

  return { waitForExit };
};

const run = async () => {
  const cli = readCliInput(process.argv.slice(2));
  const options = cli.options;
  const commandRuntimeInput = cli.command.length > 0 ? { command: cli.command } : undefined;
  let commandRuntime: CommandRuntime | undefined;
  let initialSyncPending = true;
  const ensureCommandRuntime = () => {
    if (!commandRuntimeInput || commandRuntime) {
      return;
    }
    commandRuntime = startCommandRuntime(commandRuntimeInput);
  };

  const execute = async () => {
    const { checksumFile } = resolveOutputPaths(options.out);
    const cached = await readCachedChecksum(checksumFile);
    const useCachedEtag = !initialSyncPending && cached.generatorHash === CLIENT_GENERATOR_HASH;
    const cachedEtag = useCachedEtag ? cached.etag : undefined;

    const result = await fetchAst(options, cachedEtag);
    if (result.notModified) {
      initialSyncPending = false;
      return;
    }
    if (result.ast === undefined) {
      throw new Error('Explain response missing AST.');
    }

    const writeResult = await writeClientFiles(result.ast, options, {
      checksum: result.checksum,
      etag: result.etag,
      schemaVersion: result.schemaVersion,
      generatedAt: result.generatedAt,
    }, { forceWrite: initialSyncPending });
    initialSyncPending = false;
    if (writeResult.updated) {
      const buildResult = await buildGeneratedClient({ options });
      // eslint-disable-next-line no-console
      const details: string[] = [];
      if (writeResult.schemaVersion) {
        details.push(`schema ${writeResult.schemaVersion}`);
      }
      if (writeResult.generatedAt) {
        details.push(`generated ${writeResult.generatedAt}`);
      }
      if (writeResult.summary) {
        details.push(`${writeResult.summary.subscriptions} subscriptions`);
        details.push(`${writeResult.summary.fieldResolvers} fieldResolvers`);
        details.push(`${writeResult.summary.inputs} inputs`);
        details.push(`${writeResult.summary.outputs} outputs`);
      }
      details.push(`build ${buildResult.formats.join('+')}${buildResult.dts ? '+dts' : ''}`);
      details.push(`dist ${buildResult.outputPath}`);
      const detailsInfo = details.length > 0 ? `, ${details.join(', ')}` : '';
      console.log(`livon: client updated (checksum ${writeResult.checksum}${detailsInfo})`);
    }
  };

  const withRetry = async (action: () => Promise<void>) => {
    const maxAttempts = 20;
    const baseDelay = 250;
    let waitingForEndpointLogged = false;
    const runAttempt = async (attempt: number, resetApplied: boolean): Promise<void> => {
      try {
        await action();
        waitingForEndpointLogged = false;
        return;
      } catch (error) {
        const retryAware = error as RetryAwareError;
        const shouldReset = Boolean(retryAware?.[RETRY_RESET_AFTER_CONNECTION]) && !resetApplied;
        const nextAttempt = shouldReset ? 1 : attempt + 1;
        const nextResetApplied = shouldReset ? true : resetApplied;
        if (nextAttempt >= maxAttempts) {
          throw new Error('livon: giving up after repeated retries');
        }
        const wait = baseDelay * Math.min(nextAttempt, 10);
        if (isConnectionRefusedError(error)) {
          if (!waitingForEndpointLogged) {
            // eslint-disable-next-line no-console
            console.log(`livon: waiting for endpoint ${options.endpoint}...`);
            waitingForEndpointLogged = true;
          }
        } else {
          // eslint-disable-next-line no-console
          console.warn(`livon: attempt ${nextAttempt}/${maxAttempts} failed: ${error instanceof Error ? error.message : String(error)} – retrying in ${wait}ms`);
        }
        await new Promise((resolve) => setTimeout(resolve, wait));
        await runAttempt(nextAttempt, nextResetApplied);
      }
    };

    await runAttempt(0, false);
  };

  if (options.poll && options.poll > 0) {
    let inFlight = false;
    const tick = async () => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      try {
        await withRetry(execute);
        ensureCommandRuntime();
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('livon: poll error', error);
      } finally {
        inFlight = false;
        setTimeout(tick, options.poll);
      }
    };
    await tick();
    return;
  }

  await withRetry(execute);
  ensureCommandRuntime();
  if (commandRuntime) {
    const commandExitCode = await commandRuntime.waitForExit;
    process.exit(commandExitCode);
  }
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
