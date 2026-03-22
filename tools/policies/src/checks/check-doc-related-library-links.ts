import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectFiles, exists } from '../shared/fs-utils.ts';
import { normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const DOCS_BASE_URL = 'https://livon.tech';
const NPM_PACKAGE_HOST = 'www.npmjs.com';
const INTERNAL_PACKAGE_PREFIX = '@livon/';
const RELATED_LIBRARY_ROW_PATTERN = /<div class(?:Name)?="livon-badge-row livon-tech-row">([\s\S]*?)<\/div>/g;
const RELATED_LIBRARY_CHIP_PATTERN = /<a href="([^"]+)"><code>([^<]+)<\/code><\/a>/g;
const RELATED_LIBRARY_CODE_PATTERN = /<code>([^<]+)<\/code>/g;

const countLineNumber = (source: string, index: number): number => {
  let line = 1;
  for (let cursor = 0; cursor < index; cursor += 1) {
    if (source.charCodeAt(cursor) === 10) {
      line += 1;
    }
  }
  return line;
};

const collectDocsFiles = async (context: PolicyContext): Promise<readonly string[]> => {
  const docsDir = path.join(context.websiteDir, 'docs');
  const docsFiles = await collectFiles(docsDir);
  const rootReadme = path.join(context.baseDir, 'README.md');

  return [...new Set([...docsFiles, rootReadme])].filter((filePath) => {
    return filePath.endsWith('.md') || filePath.endsWith('.mdx');
  });
};

const isAllowedInternalHref = (href: string, packageName: string): boolean => {
  return href === `/docs/packages/${packageName}` || href === `${DOCS_BASE_URL}/docs/packages/${packageName}`;
};

const isAllowedExternalHref = (href: string, packageName: string): boolean => {
  try {
    const url = new URL(href);
    if (url.protocol !== 'https:' || url.hostname !== NPM_PACKAGE_HOST) {
      return false;
    }

    if (!url.pathname.startsWith('/package/')) {
      return false;
    }

    const targetPackage = decodeURIComponent(url.pathname.slice('/package/'.length).replace(/\/+$/, ''));
    return targetPackage === packageName;
  } catch {
    return false;
  }
};

export const runDocRelatedLibraryLinksCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const files = await collectDocsFiles(context);
  const errors: string[] = [];
  let checkedFiles = 0;
  let checkedRows = 0;
  let checkedChips = 0;

  for (const filePath of files) {
    const source = await readFile(filePath, 'utf8').catch(() => null);
    if (!source || !source.includes('livon-tech-row')) {
      continue;
    }

    checkedFiles += 1;
    const relativePath = normalizePath(path.relative(context.baseDir, filePath));
    const rows = [...source.matchAll(RELATED_LIBRARY_ROW_PATTERN)];

    for (const row of rows) {
      const rowIndex = row.index ?? 0;
      const line = countLineNumber(source, rowIndex);
      const rowSource = row[1];
      const chips = [...rowSource.matchAll(RELATED_LIBRARY_CHIP_PATTERN)].map((match) => {
        return {
          href: match[1],
          label: match[2],
        };
      });
      const codes = [...rowSource.matchAll(RELATED_LIBRARY_CODE_PATTERN)].map((match) => match[1]);

      checkedRows += 1;
      checkedChips += chips.length;

      if (chips.length === 0) {
        errors.push(`${relativePath}:${line} [docs-related-library-links] related library chips must be linked code chips`);
        continue;
      }

      if (chips.length !== codes.length) {
        errors.push(`${relativePath}:${line} [docs-related-library-links] every related library code chip must be wrapped in an anchor`);
      }

      for (const { href, label } of chips) {
        if (label.startsWith(INTERNAL_PACKAGE_PREFIX)) {
          const packageName = label.slice(INTERNAL_PACKAGE_PREFIX.length);
          if (packageName.length === 0 || packageName.includes('/')) {
            errors.push(`${relativePath}:${line} [docs-related-library-links] invalid internal package label "${label}"`);
            continue;
          }

          if (!isAllowedInternalHref(href, packageName)) {
            errors.push(
              `${relativePath}:${line} [docs-related-library-links] internal library "${label}" must link to /docs/packages/${packageName} or ${DOCS_BASE_URL}/docs/packages/${packageName}`,
            );
            continue;
          }

          const docExists = (await exists(path.join(context.websiteDir, 'docs', 'packages', `${packageName}.md`)))
            || (await exists(path.join(context.websiteDir, 'docs', 'packages', `${packageName}.mdx`)));

          if (!docExists) {
            errors.push(`${relativePath}:${line} [docs-related-library-links] missing docs page for internal library "${label}"`);
          }

          continue;
        }

        if (!isAllowedExternalHref(href, label)) {
          errors.push(
            `${relativePath}:${line} [docs-related-library-links] external library "${label}" must link to https://www.npmjs.com/package/${label}`,
          );
        }
      }
    }
  }

  return {
    id: 'docs-related-library-links',
    errors,
    info: [
      `files=${checkedFiles}`,
      `rows=${checkedRows}`,
      `chips=${checkedChips}`,
    ],
  };
};
