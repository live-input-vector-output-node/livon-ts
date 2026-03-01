import path from 'node:path';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

export interface ReadmeSyncTarget {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface ReadmeSyncConfig {
  readonly version: number;
  readonly docsBaseUrl: string;
  readonly generatedNotice: string;
  readonly targets: ReadmeSyncTarget[];
}

export interface ReadmeSyncMismatch {
  readonly target: string;
  readonly reason: string;
}

export interface ReadmeSyncReport {
  readonly errors: string[];
  readonly mismatches: ReadmeSyncMismatch[];
  readonly updated: string[];
}

const README_SYNC_CONFIG_PATH = path.join('configs', 'docs', 'readme-sync.json');

const resolveWorkspaceRoot = (startDir = process.cwd()): string => {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return path.resolve(startDir);
};

const stripQuoteWrapping = (value: string): string => {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseFrontmatterAndBody = (source: string): { title: string; body: string } => {
  const frontmatterMatch = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!frontmatterMatch) {
    return {
      title: '',
      body: source,
    };
  }

  const frontmatter = frontmatterMatch[1];
  const body = source.slice(frontmatterMatch[0].length);
  const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);

  return {
    title: titleMatch ? stripQuoteWrapping(titleMatch[1]) : '',
    body,
  };
};

const splitPathSuffix = (href: string): { destination: string; suffix: string } => {
  const index = href.search(/[?#]/);
  if (index < 0) {
    return {
      destination: href,
      suffix: '',
    };
  }
  return {
    destination: href.slice(0, index),
    suffix: href.slice(index),
  };
};

const splitMarkdownLinkDestination = (raw: string): { destination: string; trailing: string } => {
  const match = raw.match(/^(\S+)(\s+["'][^"']*["'])$/);
  if (!match) {
    return {
      destination: raw,
      trailing: '',
    };
  }
  return {
    destination: match[1],
    trailing: match[2],
  };
};

const toDocRoute = (sourcePath: string): string => {
  const normalized = sourcePath.replace(/\\/g, '/');
  const relative = normalized.replace(/^website\/docs\//, '').replace(/\.mdx?$/, '');
  return `/docs/${relative}`;
};

const resolveDocLink = (
  href: string,
  docRoute: string,
  docsBaseUrl: string,
): string => {
  if (
    href.startsWith('http://')
    || href.startsWith('https://')
    || href.startsWith('mailto:')
    || href.startsWith('tel:')
    || href.startsWith('#')
  ) {
    return href;
  }

  if (href.startsWith('/')) {
    return `${docsBaseUrl}${href}`;
  }

  const { destination, suffix } = splitPathSuffix(href);
  const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(docRoute), destination));
  const absolutePath = resolved.startsWith('/') ? resolved : `/${resolved}`;
  return `${docsBaseUrl}${absolutePath}${suffix}`;
};

const rewriteMarkdownLinks = (body: string, docRoute: string, docsBaseUrl: string): string => {
  const lines = body.split('\n');
  let insideCodeFence = false;

  const rewritten = lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('```')) {
      insideCodeFence = !insideCodeFence;
      return line;
    }
    if (insideCodeFence) {
      return line;
    }

    return line.replace(/(!?\[[^\]]+\]\()([^)]+)(\))/g, (_match, prefix, rawDestination, suffix) => {
      const { destination, trailing } = splitMarkdownLinkDestination(rawDestination);
      const rewrittenDestination = resolveDocLink(destination, docRoute, docsBaseUrl);
      return `${prefix}${rewrittenDestination}${trailing}${suffix}`;
    });
  });

  return rewritten.join('\n');
};

const normalizeOutput = (value: string): string => `${value.trim()}\n`;

const generateReadme = async (
  baseDir: string,
  config: ReadmeSyncConfig,
  target: ReadmeSyncTarget,
): Promise<string> => {
  const sourcePath = path.join(baseDir, target.source);
  const source = await readFile(sourcePath, 'utf8');
  const { title, body } = parseFrontmatterAndBody(source);
  const docRoute = toDocRoute(target.source);
  const rewrittenBody = rewriteMarkdownLinks(body, docRoute, config.docsBaseUrl);
  const heading = title.length > 0 ? `# ${title}\n\n` : '';
  const composed = `${config.generatedNotice}\n\n${heading}${rewrittenBody}`;
  return normalizeOutput(composed);
};

const loadReadmeSyncConfig = async (baseDir: string): Promise<ReadmeSyncConfig> => {
  const configPath = path.join(baseDir, README_SYNC_CONFIG_PATH);
  const raw = await readFile(configPath, 'utf8');
  return JSON.parse(raw) as ReadmeSyncConfig;
};

export const createReadmeSyncReport = async (
  baseDir: string,
  options?: { write?: boolean },
): Promise<ReadmeSyncReport> => {
  const config = await loadReadmeSyncConfig(baseDir).catch(() => null);
  if (!config) {
    return {
      errors: [`${README_SYNC_CONFIG_PATH}: invalid or unreadable JSON`],
      mismatches: [],
      updated: [],
    };
  }

  if (!Array.isArray(config.targets) || config.targets.length === 0) {
    return {
      errors: [`${README_SYNC_CONFIG_PATH}: targets must be a non-empty array`],
      mismatches: [],
      updated: [],
    };
  }

  const errors: string[] = [];
  const mismatches: ReadmeSyncMismatch[] = [];
  const updated: string[] = [];

  for (const target of config.targets) {
    if (!target.source.replace(/\\/g, '/').startsWith('website/docs/')) {
      errors.push(`${target.source}: source must be under website/docs (target ${target.id})`);
      continue;
    }

    const sourcePath = path.join(baseDir, target.source);
    const targetPath = path.join(baseDir, target.target);

    if (!existsSync(sourcePath)) {
      errors.push(`${target.source}: source file does not exist (${target.id})`);
      continue;
    }
    if (!existsSync(targetPath)) {
      errors.push(`${target.target}: target file does not exist (${target.id})`);
      continue;
    }

    const expected = await generateReadme(baseDir, config, target);
    const current = normalizeOutput(await readFile(targetPath, 'utf8'));

    if (current !== expected) {
      mismatches.push({
        target: target.target,
        reason: `out of sync with ${target.source}`,
      });

      if (options?.write) {
        await mkdir(path.dirname(targetPath), { recursive: true });
        await writeFile(targetPath, expected, 'utf8');
        updated.push(target.target);
      }
    }
  }

  return {
    errors,
    mismatches,
    updated,
  };
};

export { resolveWorkspaceRoot };
