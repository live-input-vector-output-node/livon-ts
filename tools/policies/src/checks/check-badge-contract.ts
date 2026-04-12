import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectFiles } from '../shared/fs-utils.ts';
import { normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface BadgeFileContract {
  readonly filePath: string;
  readonly requiredPatterns: readonly string[];
  readonly forbiddenPatterns: readonly string[];
}

const REPO = 'live-input-vector-output-node/livon-ts';
const SCORECARD_BADGE = `https://api.scorecard.dev/projects/github.com/${REPO}/badge`;
const BEST_PRACTICES_BADGE = 'https://www.bestpractices.dev/projects/12249/badge';
const REUSE_BADGE = `https://api.reuse.software/badge/github.com/${REPO}`;
const CI_BADGE = `https://img.shields.io/github/actions/workflow/status/${REPO}/ci.yml?branch=main&label=ci`;
const VULNERABILITY_SCAN_BADGE = `https://img.shields.io/github/actions/workflow/status/${REPO}/vulnerability-scan.yml?branch=main&label=vulnerability%20scan`;
const VULNERABILITY_SCAN_WORKFLOW = `https://github.com/${REPO}/actions/workflows/vulnerability-scan.yml`;

const REPO_BADGE_CONTRACT = {
  requiredPatterns: [
    CI_BADGE,
    VULNERABILITY_SCAN_BADGE,
    VULNERABILITY_SCAN_WORKFLOW,
    SCORECARD_BADGE,
    BEST_PRACTICES_BADGE,
    REUSE_BADGE,
  ],
  forbiddenPatterns: [
    'test/github/live-input-vector-output-node/livon-ts/',
    'test/npm/@livon/',
    'https://img.shields.io/librariesio/github/live-input-vector-output-node/livon-ts',
    'https://github.com/live-input-vector-output-node/livon-ts/actions/workflows/publish.yml',
    'https://img.shields.io/github/actions/workflow/status/live-input-vector-output-node/livon-ts/publish.yml',
  ],
} as const;

const PACKAGE_BADGE_CONTRACT = {
  requiredPatterns: [
    CI_BADGE,
    `[![Vulnerability scan](${VULNERABILITY_SCAN_BADGE})](${VULNERABILITY_SCAN_WORKFLOW})`,
    SCORECARD_BADGE,
    BEST_PRACTICES_BADGE,
    REUSE_BADGE,
    '[![npm](https://img.shields.io/npm/v/%40livon%2F',
    '[![license](https://img.shields.io/npm/l/%40livon%2F',
  ],
  forbiddenPatterns: [
    'test/npm/@livon/',
    'libraries.io',
    'sourcerank',
    'img.shields.io/npm/unpacked-size',
    '/actions/workflows/publish.yml',
    '/publish.yml?branch=main&label=npm%20publish',
  ],
} as const;

const SCHEMA_BADGE_CONTRACT = {
  requiredPatterns: [
    '[![npm](https://img.shields.io/npm/v/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)',
    CI_BADGE,
    `[![Vulnerability scan](${VULNERABILITY_SCAN_BADGE})](${VULNERABILITY_SCAN_WORKFLOW})`,
    SCORECARD_BADGE,
    BEST_PRACTICES_BADGE,
    REUSE_BADGE,
    '[![license](https://img.shields.io/npm/l/%40livon%2Fschema)](https://www.npmjs.com/package/@livon/schema)',
  ],
  forbiddenPatterns: [
    'test/npm/@livon/',
    'libraries.io',
    'sourcerank',
    'img.shields.io/npm/unpacked-size',
    '/actions/workflows/publish.yml',
    '/publish.yml?branch=main&label=npm%20publish',
    '/actions/workflows/code-quality.yml',
  ],
} as const;

const createBadgeFileContract = (
  filePath: string,
  requiredPatterns: readonly string[],
  forbiddenPatterns: readonly string[],
): BadgeFileContract => {
  return {
    filePath,
    requiredPatterns,
    forbiddenPatterns,
  };
};

export const runBadgeContractCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const docsPackagesDir = path.join(context.websiteDir, 'docs', 'packages');
  const docsSchemaDir = path.join(context.websiteDir, 'docs', 'schema');

  const packageDocsFiles = (await collectFiles(docsPackagesDir))
    .filter((filePath) => filePath.endsWith('.md') && !filePath.endsWith(`${path.sep}index.md`))
    .sort();
  const schemaDocsFiles = (await collectFiles(docsSchemaDir))
    .filter((filePath) => filePath.endsWith('.md'))
    .sort();

  const contracts: BadgeFileContract[] = [
    createBadgeFileContract(
      path.join(context.baseDir, 'README.md'),
      REPO_BADGE_CONTRACT.requiredPatterns,
      REPO_BADGE_CONTRACT.forbiddenPatterns,
    ),
    createBadgeFileContract(
      path.join(context.websiteDir, 'docs', 'index.md'),
      REPO_BADGE_CONTRACT.requiredPatterns,
      REPO_BADGE_CONTRACT.forbiddenPatterns,
    ),
    ...packageDocsFiles.map((filePath) => {
      return createBadgeFileContract(
        filePath,
        PACKAGE_BADGE_CONTRACT.requiredPatterns,
        PACKAGE_BADGE_CONTRACT.forbiddenPatterns,
      );
    }),
    ...schemaDocsFiles.map((filePath) => {
      return createBadgeFileContract(
        filePath,
        SCHEMA_BADGE_CONTRACT.requiredPatterns,
        SCHEMA_BADGE_CONTRACT.forbiddenPatterns,
      );
    }),
  ];

  const errors: string[] = [];

  for (const contract of contracts) {
    const source = await readFile(contract.filePath, 'utf8').catch(() => null);
    const relativePath = normalizePath(path.relative(context.baseDir, contract.filePath));

    if (source === null) {
      errors.push(`${relativePath}: unable to read file for badge contract checks`);
      continue;
    }

    for (const requiredPattern of contract.requiredPatterns) {
      if (!source.includes(requiredPattern)) {
        errors.push(`${relativePath}: missing required badge pattern "${requiredPattern}"`);
      }
    }

    for (const forbiddenPattern of contract.forbiddenPatterns) {
      if (source.includes(forbiddenPattern)) {
        errors.push(`${relativePath}: found deprecated badge pattern "${forbiddenPattern}"`);
      }
    }
  }

  return {
    id: 'badge-contract',
    errors,
    info: [
      `files=${contracts.length}`,
      `packageDocs=${packageDocsFiles.length}`,
      `schemaDocs=${schemaDocsFiles.length}`,
    ],
  };
};
