import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const docsHost = 'https://live-input-vector-output-node.github.io/livon-ts';
const rootDirectory = process.cwd();
const docsRootDirectory = path.join(rootDirectory, 'website', 'docs');

const targets = [
  { packageDirectory: 'packages/runtime', docsFile: 'website/docs/packages/runtime.md' },
  { packageDirectory: 'packages/schema', docsFile: 'website/docs/packages/schema.md' },
  { packageDirectory: 'packages/client', docsFile: 'website/docs/packages/client.md' },
  { packageDirectory: 'packages/client-ws-transport', docsFile: 'website/docs/packages/client-ws-transport.md' },
  { packageDirectory: 'packages/server-ws-transport', docsFile: 'website/docs/packages/node-ws-transport.md' },
  { packageDirectory: 'packages/dlq-module', docsFile: 'website/docs/packages/dlq-module.md' },
  { packageDirectory: 'packages/config', docsFile: 'website/docs/packages/config.md' },
  { packageDirectory: 'packages/cli', docsFile: 'website/docs/packages/cli.md' },
];

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');

const normalizeSlashes = (value) => value.split(path.sep).join('/');

const stripQuotes = (value) =>
  value.length >= 2 && (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  )
    ? value.slice(1, -1)
    : value;

const parseFrontmatter = (content) => {
  if (!content.startsWith('---\n')) {
    return { title: undefined, body: content };
  }

  const frontmatterEnd = content.indexOf('\n---\n', 4);
  if (frontmatterEnd < 0) {
    return { title: undefined, body: content };
  }

  const frontmatter = content.slice(4, frontmatterEnd);
  const body = content.slice(frontmatterEnd + 5);
  const titleLine = frontmatter
    .split('\n')
    .find((line) => line.trimStart().startsWith('title:'));
  const titleValue = titleLine ? titleLine.split(':').slice(1).join(':').trim() : undefined;

  return {
    title: titleValue ? stripQuotes(titleValue) : undefined,
    body,
  };
};

const removeMarkdownExtension = (value) => value.replace(/\.(md|mdx)$/i, '');

const normalizeDocsPath = (value) => {
  const withoutExtension = removeMarkdownExtension(value);
  if (withoutExtension === '/docs/index') {
    return '/docs';
  }
  if (withoutExtension.endsWith('/index')) {
    return withoutExtension.slice(0, -('/index'.length));
  }
  return withoutExtension;
};

const routeFromDocsFile = (docsFilePath) => {
  const absoluteFile = path.resolve(rootDirectory, docsFilePath);
  const relativeToDocs = normalizeSlashes(path.relative(docsRootDirectory, absoluteFile));
  return normalizeDocsPath(`/docs/${relativeToDocs}`);
};

const splitLinkParts = (value) => {
  const hashIndex = value.indexOf('#');
  const withNoHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const queryIndex = withNoHash.indexOf('?');
  const pathname = queryIndex >= 0 ? withNoHash.slice(0, queryIndex) : withNoHash;
  const query = queryIndex >= 0 ? withNoHash.slice(queryIndex) : '';
  return { pathname, query, hash };
};

const resolveRelativeRoute = ({ baseRoute, inputPath }) => {
  const baseDirectory = path.posix.dirname(baseRoute);
  const combined = path.posix.normalize(path.posix.join(baseDirectory, inputPath));
  const prefixed = combined.startsWith('/') ? combined : `/${combined}`;
  return normalizeDocsPath(prefixed);
};

const normalizeLinkTarget = ({ baseRoute, target }) => {
  if (
    target.startsWith('http://')
    || target.startsWith('https://')
    || target.startsWith('mailto:')
    || target.startsWith('tel:')
    || target.startsWith('#')
  ) {
    return target;
  }

  const { pathname, query, hash } = splitLinkParts(target);

  if (pathname.startsWith('/docs')) {
    return `${docsHost}${normalizeDocsPath(pathname)}${query}${hash}`;
  }

  if (pathname.startsWith('/')) {
    return `${docsHost}${pathname}${query}${hash}`;
  }

  const resolvedRoute = resolveRelativeRoute({ baseRoute, inputPath: pathname });
  return `${docsHost}${resolvedRoute}${query}${hash}`;
};

const rewriteMarkdownLinks = ({ content, baseRoute }) =>
  content.replace(/(!?\[[^\]]*\]\()([^)\s]+)(\))/g, (_, start, target, end) => {
    const normalizedTarget = normalizeLinkTarget({ baseRoute, target });
    return `${start}${normalizedTarget}${end}`;
  });

const trimExtraLeadingEmptyLines = (value) => value.replace(/^\s+/, '').replace(/\n{3,}/g, '\n\n');

const renderReadme = ({ docsFile, title, body, route }) => {
  const normalizedBody = trimExtraLeadingEmptyLines(rewriteMarkdownLinks({ content: body, baseRoute: route }));
  const heading = title ? `# ${title}\n\n` : '';
  const autoHeader = [
    '<!-- AUTO-GENERATED: run `pnpm docs:sync:package-readmes` -->',
    `<!-- Source: ${docsFile} -->`,
    '',
  ].join('\n');
  return `${autoHeader}${heading}${normalizedBody.trimEnd()}\n`;
};

const targetEntries = targets.map((target) => {
  const docsAbsolutePath = path.resolve(rootDirectory, target.docsFile);
  const docsRaw = readFileSync(docsAbsolutePath, 'utf8');
  const { title, body } = parseFrontmatter(docsRaw);
  const route = routeFromDocsFile(target.docsFile);
  const readmePath = path.resolve(rootDirectory, target.packageDirectory, 'README.md');
  const nextReadme = renderReadme({
    docsFile: target.docsFile,
    title,
    body,
    route,
  });
  const previousReadme = readFileSync(readmePath, 'utf8');

  return {
    readmePath,
    packageDirectory: target.packageDirectory,
    changed: previousReadme !== nextReadme,
    nextReadme,
  };
});

const changedEntries = targetEntries.filter((entry) => entry.changed);

if (checkOnly) {
  if (changedEntries.length > 0) {
    // eslint-disable-next-line no-console
    console.error('Package README sync check failed. Run `pnpm docs:sync:package-readmes`.');
    changedEntries.forEach((entry) => {
      // eslint-disable-next-line no-console
      console.error(`- ${entry.packageDirectory}/README.md is out of sync`);
    });
    process.exit(1);
  }
  // eslint-disable-next-line no-console
  console.log('Package README sync check passed.');
  process.exit(0);
}

changedEntries.forEach((entry) => {
  writeFileSync(entry.readmePath, entry.nextReadme, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`synced ${entry.packageDirectory}/README.md`);
});

if (changedEntries.length === 0) {
  // eslint-disable-next-line no-console
  console.log('package READMEs already in sync');
}
