import { existsSync, readdirSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { pathToFileURL } from 'node:url';
import { resolveWorkspaceBaseDir } from './src/shared/workspace-root.ts';

export interface LinkCheckMetrics {
  readonly scannedFiles: number;
  readonly scannedTextFiles: number;
  readonly skippedBinaryFiles: number;
  readonly referencesTotal: number;
  readonly localReferences: number;
  readonly externalReferences: number;
  readonly externalUrlsChecked: number;
  readonly localBroken: number;
  readonly externalBroken: number;
  readonly externalRestricted: number;
}

export interface LinkCheckExternalEntry {
  readonly url: string;
  readonly statusCode: number;
  readonly state: 'ok' | 'restricted' | 'broken';
  readonly sources: string[];
}

export interface LinkCheckLocalIssue {
  readonly source: string;
  readonly line: number;
  readonly kind: string;
  readonly target: string;
}

export interface LinkCheckResult {
  readonly baseDir: string;
  readonly metrics: LinkCheckMetrics;
  readonly errors: string[];
  readonly localErrors: LinkCheckLocalIssue[];
  readonly externalBroken: LinkCheckExternalEntry[];
  readonly externalRestricted: LinkCheckExternalEntry[];
}

export interface RunLinkCheckOptions {
  readonly baseDir?: string;
  readonly checkExternal?: boolean;
  readonly externalConcurrency?: number;
  readonly verbose?: boolean;
}

const execFileAsync = promisify(execFile);

const ROOT = process.cwd();
const BASE = resolveWorkspaceBaseDir(ROOT);
const SKIPPED_DIR_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  '.docusaurus',
  '.next',
  '.turbo',
  'coverage',
]);
const CODE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);
const TS_FAMILY_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts']);
const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0']);
const EXTERNAL_RESTRICTED_STATUS_CODES = new Set([401, 403, 405, 407, 429, 999]);
const COMMON_LOCAL_PATH_EXTENSIONS = [
  '.md',
  '.mdx',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.json',
  '.yaml',
  '.yml',
  '.toml',
  '.html',
  '.css',
  '.scss',
  '.png',
  '.jpg',
  '.jpeg',
  '.svg',
  '.webp',
  '.gif',
  '.txt',
];
const IMPORT_REFERENCE_KINDS = new Set(['import_export', 'require', 'dynamic_import']);

let cachedTypeScriptModule;

const normalizePath = (value) => value.replace(/\\/g, '/');

const uniqueBy = (items, keyFn) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const isProbablyBinary = (buffer) => {
  if (!buffer || buffer.length === 0) {
    return false;
  }

  let suspicious = 0;
  const sampleLength = Math.min(buffer.length, 4096);
  for (let index = 0; index < sampleLength; index += 1) {
    const code = buffer[index];
    if (code === 0) {
      return true;
    }
    if (code < 7 || (code > 14 && code < 32)) {
      suspicious += 1;
    }
  }

  return suspicious / sampleLength > 0.3;
};

const countLineNumber = (text, index) => {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
};

const normalizeTarget = (rawTarget) => {
  let target = (rawTarget ?? '').trim();
  if (!target) {
    return '';
  }

  if ((target.startsWith('"') && target.endsWith('"')) || (target.startsWith("'") && target.endsWith("'"))) {
    target = target.slice(1, -1);
  }
  if (target.startsWith('<') && target.endsWith('>')) {
    target = target.slice(1, -1);
  }

  const whitespaceIndex = target.search(/\s/);
  if (whitespaceIndex > 0) {
    target = target.slice(0, whitespaceIndex);
  }

  return target.replace(/[),.;]+$/, '');
};

const stripQueryAndAnchor = (value) => {
  const hashIndex = value.indexOf('#');
  const withoutHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const queryIndex = withoutHash.indexOf('?');
  return queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
};

const isExternalTarget = (target) => /^(https?:|\/\/|mailto:|tel:|data:|javascript:)/i.test(target);

const shouldSkipLocalTarget = (target) => {
  if (!target || target === '#') {
    return true;
  }
  if (target.startsWith('#')) {
    return true;
  }
  if (target.startsWith('{') || target.includes('${')) {
    return true;
  }
  return false;
};

const listFilesFallback = (baseDir) => {
  const collected = [];
  const walk = (dirPath) => {
    const entries = readdirSync(dirPath, { withFileTypes: true });
    entries.forEach((entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIR_NAMES.has(entry.name)) {
          walk(absolutePath);
        }
        return;
      }
      if (entry.isFile()) {
        collected.push(absolutePath);
      }
    });
  };

  walk(baseDir);
  return collected;
};

const listTrackedFiles = async (baseDir) => {
  try {
    const { stdout } = await execFileAsync('git', ['-C', baseDir, 'ls-files']);
    return stdout
      .split('\n')
      .filter((line) => line.length > 0)
      .map((relativePath) => path.join(baseDir, relativePath));
  } catch {
    return listFilesFallback(baseDir);
  }
};

const extractStaticReferences = (filePath, sourceText) => {
  const references = [];
  const patterns = [
    {
      kind: 'markdown_link',
      regex: /\[[^\]]*\]\(([^)]+)\)/g,
    },
    {
      kind: 'markdown_reference',
      regex: /^\[[^\]]+\]:\s*(\S+)/gm,
    },
    {
      kind: 'html_attr',
      regex: /\b(?:href|src)=['"]([^'"]+)['"]/g,
    },
    {
      kind: 'agent_load',
      regex: /@agent\.load:\s*([^\s>]+)/g,
    },
    {
      kind: 'raw_url',
      regex: /(https?:\/\/[^\s"'`<>\])}]+)/g,
    },
  ];

  patterns.forEach(({ kind, regex }) => {
    let match = regex.exec(sourceText);
    while (match !== null) {
      const target = normalizeTarget(match[1]);
      if (target) {
        references.push({
          kind,
          sourcePath: filePath,
          sourceExtension: path.extname(filePath).toLowerCase(),
          line: countLineNumber(sourceText, match.index),
          target,
        });
      }
      match = regex.exec(sourceText);
    }
  });

  return references;
};

const getTypeScriptModule = async () => {
  if (cachedTypeScriptModule !== undefined) {
    return cachedTypeScriptModule;
  }
  try {
    cachedTypeScriptModule = await import('typescript');
  } catch {
    cachedTypeScriptModule = null;
  }
  return cachedTypeScriptModule;
};

const scriptKindForExtension = async (extension) => {
  const tsModule = await getTypeScriptModule();
  if (!tsModule) {
    return null;
  }

  if (extension === '.ts') return tsModule.ScriptKind.TS;
  if (extension === '.tsx') return tsModule.ScriptKind.TSX;
  if (extension === '.js') return tsModule.ScriptKind.JS;
  if (extension === '.jsx') return tsModule.ScriptKind.JSX;
  if (extension === '.mjs' || extension === '.cjs') return tsModule.ScriptKind.JS;
  if (extension === '.mts' || extension === '.cts') return tsModule.ScriptKind.TS;
  return tsModule.ScriptKind.Unknown;
};

const extractCodeModuleReferencesViaRegexFallback = (filePath, sourceText, extension) => {
  const references = [];
  const patterns = [
    {
      kind: 'import_export',
      regex: /\b(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g,
    },
    {
      kind: 'require',
      regex: /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
    {
      kind: 'dynamic_import',
      regex: /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
    },
  ];

  patterns.forEach(({ kind, regex }) => {
    let match = regex.exec(sourceText);
    while (match !== null) {
      const target = normalizeTarget(match[1]);
      if (target && (target.startsWith('./') || target.startsWith('../') || target.startsWith('/'))) {
        references.push({
          kind,
          sourcePath: filePath,
          sourceExtension: extension,
          line: countLineNumber(sourceText, match.index),
          target,
        });
      }
      match = regex.exec(sourceText);
    }
  });

  return references;
};

const extractCodeModuleReferences = async (filePath, sourceText, extension) => {
  const tsModule = await getTypeScriptModule();
  if (!tsModule) {
    return extractCodeModuleReferencesViaRegexFallback(filePath, sourceText, extension);
  }

  const scriptKind = await scriptKindForExtension(extension);
  const sourceFile = tsModule.createSourceFile(
    filePath,
    sourceText,
    tsModule.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const references = [];
  const pushReference = (kind, node, targetValue) => {
    const target = normalizeTarget(targetValue);
    if (!target || (!target.startsWith('./') && !target.startsWith('../') && !target.startsWith('/'))) {
      return;
    }

    const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
    references.push({
      kind,
      sourcePath: filePath,
      sourceExtension: extension,
      line,
      target,
    });
  };

  const visit = (node) => {
    if (
      (tsModule.isImportDeclaration(node) || tsModule.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      tsModule.isStringLiteral(node.moduleSpecifier)
    ) {
      pushReference('import_export', node.moduleSpecifier, node.moduleSpecifier.text);
    }

    if (tsModule.isCallExpression(node) && node.arguments.length > 0) {
      const [firstArg] = node.arguments;
      if (firstArg && tsModule.isStringLiteral(firstArg)) {
        if (node.expression.kind === tsModule.SyntaxKind.ImportKeyword) {
          pushReference('dynamic_import', firstArg, firstArg.text);
        }
        if (tsModule.isIdentifier(node.expression) && node.expression.text === 'require') {
          pushReference('require', firstArg, firstArg.text);
        }
      }
    }

    tsModule.forEachChild(node, visit);
  };

  visit(sourceFile);
  return references;
};

const buildLocalCandidatePaths = (reference, baseDir) => {
  const target = stripQueryAndAnchor(reference.target);
  if (!target) {
    return [];
  }

  const candidates = [];
  const addCandidatesForBase = (basePath) => {
    candidates.push(basePath);
    COMMON_LOCAL_PATH_EXTENSIONS.forEach((extension) => {
      candidates.push(`${basePath}${extension}`);
    });
    candidates.push(path.join(basePath, 'index.md'));
    candidates.push(path.join(basePath, 'index.mdx'));
    candidates.push(path.join(basePath, 'index.ts'));
    candidates.push(path.join(basePath, 'index.tsx'));
    candidates.push(path.join(basePath, 'index.js'));
    candidates.push(path.join(basePath, 'README.md'));
    candidates.push(path.join(basePath, 'README.mdx'));
  };

  if (target.startsWith('/docs/')) {
    addCandidatesForBase(path.join(baseDir, 'website', 'docs', target.replace(/^\/docs\//, '')));
  }

  if (target.startsWith('/')) {
    addCandidatesForBase(path.join(baseDir, target.slice(1)));
    addCandidatesForBase(path.join(baseDir, 'website', 'static', target.slice(1)));
  } else {
    addCandidatesForBase(path.resolve(path.dirname(reference.sourcePath), target));
  }

  if (IMPORT_REFERENCE_KINDS.has(reference.kind) && TS_FAMILY_EXTENSIONS.has(reference.sourceExtension) && /\.(?:[cm]?js)$/i.test(target)) {
    const withoutJsExtension = target.replace(/\.(?:[cm]?js)$/i, '');
    const tsBasePath = withoutJsExtension.startsWith('/')
      ? path.join(baseDir, withoutJsExtension.slice(1))
      : path.resolve(path.dirname(reference.sourcePath), withoutJsExtension);
    candidates.push(`${tsBasePath}.ts`, `${tsBasePath}.tsx`, `${tsBasePath}.mts`, `${tsBasePath}.cts`);
    candidates.push(
      path.join(tsBasePath, 'index.ts'),
      path.join(tsBasePath, 'index.tsx'),
      path.join(tsBasePath, 'index.mts'),
      path.join(tsBasePath, 'index.cts'),
    );
  }

  return [...new Set(candidates)];
};

const resolveLocalReference = (reference, baseDir) => {
  const candidates = buildLocalCandidatePaths(reference, baseDir);
  const existingPath = candidates.find((candidate) => existsSync(candidate));
  if (!existingPath) {
    return null;
  }
  return existingPath;
};

const classifyExternalStatus = (statusCode) => {
  if (statusCode >= 200 && statusCode < 400) {
    return 'ok';
  }
  if (EXTERNAL_RESTRICTED_STATUS_CODES.has(statusCode) || (statusCode >= 500 && statusCode < 600)) {
    return 'restricted';
  }
  return 'broken';
};

const normalizeExternalUrl = (url) => (url.startsWith('//') ? `https:${url}` : url);

const shouldSkipExternalUrl = (url) => {
  if (url.includes('${')) {
    return true;
  }

  try {
    const parsed = new URL(normalizeExternalUrl(url));
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return true;
    }
    return LOCALHOST_HOSTS.has(parsed.hostname);
  } catch {
    return true;
  }
};

const fetchUrlStatus = async (url) => {
  const normalizedUrl = normalizeExternalUrl(url);
  const methods = ['HEAD', 'GET'];
  const createTimeoutSignal = (timeoutMs) => {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(timeoutMs);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    if (typeof timer.unref === 'function') {
      timer.unref();
    }
    return controller.signal;
  };

  const fetchUrlStatusViaCurl = async (method) => {
    const args = ['-L', '--max-time', '15', '-A', 'livon-link-check/1.0', '-o', '/dev/null', '-s', '-w', '%{http_code}'];
    if (method === 'HEAD') {
      args.push('-I');
    }
    args.push(normalizedUrl);
    try {
      const { stdout } = await execFileAsync('curl', args);
      const code = Number.parseInt(stdout.trim(), 10);
      return Number.isFinite(code) ? code : 0;
    } catch {
      return 0;
    }
  };

  for (const method of methods) {
    try {
      if (typeof fetch === 'function') {
        const response = await fetch(normalizedUrl, {
          method,
          redirect: 'follow',
          signal: createTimeoutSignal(15000),
          headers: {
            'user-agent': 'livon-link-check/1.0',
            accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
          },
        });
        const statusCode = response.status;
        if (statusCode > 0) {
          return statusCode;
        }
      } else {
        const statusCode = await fetchUrlStatusViaCurl(method);
        if (statusCode > 0) {
          return statusCode;
        }
      }
    } catch {
      // Try fallback method.
      if (typeof fetch !== 'function') {
        const statusCode = await fetchUrlStatusViaCurl(method);
        if (statusCode > 0) {
          return statusCode;
        }
      }
    }
  }

  return 0;
};

const runWithConcurrency = async (items, worker, concurrency) => {
  const results = [];
  let index = 0;

  const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
};

const createResult = (baseDir, metrics, localErrors, externalBroken, externalRestricted) => {
  const errors = [...localErrors.map((issue) => `${issue.source}:${issue.line} [${issue.kind}] -> ${issue.target}`)];
  errors.push(...externalBroken.map((entry) => `${entry.url}: status ${entry.statusCode}`));

  return {
    baseDir,
    metrics,
    errors,
    localErrors,
    externalBroken,
    externalRestricted,
  };
};

export const runLinkCheck = async ({
  baseDir = BASE,
  checkExternal = true,
  externalConcurrency = 8,
  verbose = true,
}: RunLinkCheckOptions = {}): Promise<LinkCheckResult> => {
  const trackedFiles = await listTrackedFiles(baseDir);
  const references = [];
  let textFileCount = 0;
  let binaryFileCount = 0;

  for (const filePath of trackedFiles) {
    const buffer = await readFile(filePath).catch(() => null);
    if (!buffer) {
      continue;
    }

    if (isProbablyBinary(buffer)) {
      binaryFileCount += 1;
      continue;
    }

    textFileCount += 1;
    const sourceText = buffer.toString('utf8');
    const extension = path.extname(filePath).toLowerCase();
    references.push(...extractStaticReferences(filePath, sourceText));
    if (CODE_EXTENSIONS.has(extension)) {
      references.push(...(await extractCodeModuleReferences(filePath, sourceText, extension)));
    }
  }

  const localReferences = [];
  const externalReferenceMap = new Map();

  references.forEach((reference) => {
    if (isExternalTarget(reference.target)) {
      if (reference.target.startsWith('http://') || reference.target.startsWith('https://') || reference.target.startsWith('//')) {
        if (!shouldSkipExternalUrl(reference.target)) {
          const normalizedUrl = normalizeExternalUrl(reference.target);
          const sourceRef = `${normalizePath(path.relative(baseDir, reference.sourcePath))}:${reference.line}`;
          if (!externalReferenceMap.has(normalizedUrl)) {
            externalReferenceMap.set(normalizedUrl, []);
          }
          externalReferenceMap.get(normalizedUrl).push(sourceRef);
        }
      }
      return;
    }

    if (shouldSkipLocalTarget(reference.target)) {
      return;
    }

    localReferences.push(reference);
  });

  const localIssuesRaw = localReferences
    .map((reference) => {
      const resolvedPath = resolveLocalReference(reference, baseDir);
      if (resolvedPath) {
        return null;
      }
      return {
        source: normalizePath(path.relative(baseDir, reference.sourcePath)),
        line: reference.line,
        kind: reference.kind,
        target: reference.target,
      };
    })
    .filter((entry) => entry !== null);

  const localIssues = uniqueBy(localIssuesRaw, (entry) => `${entry.source}:${entry.line}:${entry.kind}:${entry.target}`);

  const externalUrls = [...externalReferenceMap.keys()].sort();
  const externalChecks = checkExternal
    ? await runWithConcurrency(
        externalUrls,
        async (url) => {
          const statusCode = await fetchUrlStatus(url);
          const state = classifyExternalStatus(statusCode);
          return {
            url,
            statusCode,
            state,
            sources: [...new Set(externalReferenceMap.get(url))],
          };
        },
        externalConcurrency,
      )
    : [];

  const externalBroken = externalChecks.filter((entry) => entry.state === 'broken');
  const externalRestricted = externalChecks.filter((entry) => entry.state === 'restricted');

  const metrics = {
    scannedFiles: trackedFiles.length,
    scannedTextFiles: textFileCount,
    skippedBinaryFiles: binaryFileCount,
    referencesTotal: references.length,
    localReferences: localReferences.length,
    externalReferences: [...externalReferenceMap.values()].flat().length,
    externalUrlsChecked: externalUrls.length,
    localBroken: localIssues.length,
    externalBroken: externalBroken.length,
    externalRestricted: externalRestricted.length,
  };

  if (verbose) {
    console.log(
      `Link check metrics: scannedFiles=${metrics.scannedFiles}, scannedText=${metrics.scannedTextFiles}, refs=${metrics.referencesTotal}, localBroken=${metrics.localBroken}, externalBroken=${metrics.externalBroken}, externalRestricted=${metrics.externalRestricted}`,
    );

    if (localIssues.length > 0) {
      console.log('Link check local issues:');
      localIssues.forEach((issue) => {
        console.log(`- ${issue.source}:${issue.line} [${issue.kind}] -> ${issue.target}`);
      });
    }

    if (externalBroken.length > 0) {
      console.log('Link check external broken URLs:');
      externalBroken.forEach((entry) => {
        console.log(`- ${entry.url} (status ${entry.statusCode}) in ${entry.sources.slice(0, 5).join(', ')}`);
      });
    }

    if (externalRestricted.length > 0) {
      console.log('Link check external restricted URLs (non-fatal):');
      externalRestricted.forEach((entry) => {
        console.log(`- ${entry.url} (status ${entry.statusCode}) in ${entry.sources.slice(0, 5).join(', ')}`);
      });
    }
  }

  return createResult(baseDir, metrics, localIssues, externalBroken, externalRestricted);
};

const runCli = async () => {
  const result = await runLinkCheck({ baseDir: BASE, checkExternal: true, verbose: true });
  if (result.errors.length > 0) {
    console.error('Link check failed:');
    result.errors.forEach((error) => {
      console.error(`- ${error}`);
    });
    process.exit(1);
  }
  console.log('Link check passed.');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
