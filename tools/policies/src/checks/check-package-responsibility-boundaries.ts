import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectSourceFiles, exists } from '../shared/fs-utils.ts';
import { matchesAnyPattern, normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const IMPORT_PATTERN = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

const TEST_FILE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const TEST_PATH_SEGMENTS = ['/testing/', '/__tests__/', '/test/'];

interface PackageResponsibilityBoundary {
  packageDir: string;
  forbiddenPackageImports: readonly string[];
}

interface ScopedFile {
  filePath: string;
  relativePath: string;
}

interface IsCrossPackageRelativeImportInput {
  packageDir: string;
  resolvedAbsolutePath: string;
}

const withSubpathPatterns = (packageNames: readonly string[]): readonly string[] => {
  return packageNames.flatMap((packageName) => {
    return [`@livon/${packageName}`, `@livon/${packageName}/**`];
  });
};

const BOUNDARIES: readonly PackageResponsibilityBoundary[] = [
  {
    packageDir: 'runtime',
    forbiddenPackageImports: withSubpathPatterns([
      'client',
      'schema',
      'client-ws-transport',
      'node-ws-transport',
      'sync',
      'react',
      'dlq-module',
    ]),
  },
  {
    packageDir: 'schema',
    forbiddenPackageImports: withSubpathPatterns([
      'client',
      'client-ws-transport',
      'node-ws-transport',
      'sync',
      'react',
      'dlq-module',
    ]),
  },
  {
    packageDir: 'client',
    forbiddenPackageImports: withSubpathPatterns([
      'schema',
      'client-ws-transport',
      'node-ws-transport',
      'sync',
      'react',
      'dlq-module',
    ]),
  },
  {
    packageDir: 'client-ws-transport',
    forbiddenPackageImports: withSubpathPatterns([
      'schema',
      'node-ws-transport',
      'sync',
      'react',
      'dlq-module',
    ]),
  },
  {
    packageDir: 'server-ws-transport',
    forbiddenPackageImports: withSubpathPatterns([
      'schema',
      'client',
      'client-ws-transport',
      'sync',
      'react',
      'dlq-module',
    ]),
  },
  {
    packageDir: 'dlq-module',
    forbiddenPackageImports: withSubpathPatterns([
      'schema',
      'client',
      'client-ws-transport',
      'node-ws-transport',
      'sync',
      'react',
    ]),
  },
  {
    packageDir: 'sync',
    forbiddenPackageImports: withSubpathPatterns([
      'runtime',
      'schema',
      'client',
      'client-ws-transport',
      'node-ws-transport',
      'dlq-module',
      'react',
    ]),
  },
  {
    packageDir: 'react',
    forbiddenPackageImports: withSubpathPatterns([
      'runtime',
      'schema',
      'client',
      'client-ws-transport',
      'node-ws-transport',
      'dlq-module',
    ]),
  },
];

const collectSpecifiers = (source: string): readonly string[] => {
  const staticImports = [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1]);
  const dynamicImports = [...source.matchAll(DYNAMIC_IMPORT_PATTERN)].map((match) => match[1]);
  const requireImports = [...source.matchAll(REQUIRE_PATTERN)].map((match) => match[1]);
  return [...new Set([...staticImports, ...dynamicImports, ...requireImports])];
};

const isCrossPackageRelativeImport = ({
  packageDir,
  resolvedAbsolutePath,
}: IsCrossPackageRelativeImportInput): boolean => {
  if (/\/apps\//.test(resolvedAbsolutePath)) {
    return true;
  }

  const ownPackagePattern = new RegExp(`/packages/${packageDir}/`);
  if (ownPackagePattern.test(resolvedAbsolutePath)) {
    return false;
  }

  return /\/packages\//.test(resolvedAbsolutePath);
};

const isTestLikePath = (relativePath: string): boolean => {
  if (TEST_FILE_PATTERN.test(relativePath)) {
    return true;
  }

  return TEST_PATH_SEGMENTS.some((segment) => relativePath.includes(segment));
};

const collectScopedFiles = async (
  context: PolicyContext,
  packageDir: string,
): Promise<readonly ScopedFile[]> => {
  const sourceDir = path.join(context.packagesDir, packageDir, 'src');
  if (!(await exists(sourceDir))) {
    return [];
  }

  const sourceFiles = await collectSourceFiles(sourceDir);

  return sourceFiles
    .map((filePath) => {
      const relativePath = normalizePath(path.relative(context.baseDir, filePath));
      return {
        filePath,
        relativePath,
      };
    })
    .filter(({ relativePath }) => !isTestLikePath(relativePath));
};

const checkScopedFile = async (
  boundary: PackageResponsibilityBoundary,
  scopedFile: ScopedFile,
): Promise<readonly string[]> => {
  const source = await readFile(scopedFile.filePath, 'utf8').catch(() => null);
  if (!source) {
    return [];
  }

  const specifiers = collectSpecifiers(source);

  return specifiers.flatMap((specifier) => {
    if (specifier.startsWith('.')) {
      const resolvedAbsolutePath = normalizePath(path.resolve(path.dirname(scopedFile.filePath), specifier));
      if (!isCrossPackageRelativeImport({
        packageDir: boundary.packageDir,
        resolvedAbsolutePath,
      })) {
        return [];
      }

      return [
        `${scopedFile.relativePath}: forbidden cross-package relative import "${specifier}" (${resolvedAbsolutePath})`,
      ];
    }

    if (!specifier.startsWith('@livon/')) {
      return [];
    }

    if (!matchesAnyPattern(specifier, boundary.forbiddenPackageImports)) {
      return [];
    }

    return [
      `${scopedFile.relativePath}: forbidden internal import "${specifier}" for package "${boundary.packageDir}" boundary`,
    ];
  });
};

export const runPackageResponsibilityBoundariesCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const sourceFileBuckets = await Promise.all(
    BOUNDARIES.map(async (boundary) => {
      const scopedFiles = await collectScopedFiles(context, boundary.packageDir);
      return {
        boundary,
        scopedFiles,
      };
    }),
  );

  const errorsByBucket = await Promise.all(
    sourceFileBuckets.map(async ({ boundary, scopedFiles }) => {
      const fileErrors = await Promise.all(
        scopedFiles.map((scopedFile) => {
          return checkScopedFile(boundary, scopedFile);
        }),
      );

      return fileErrors.flat();
    }),
  );

  const errors = errorsByBucket.flat();
  const checkedPackages = sourceFileBuckets.filter(({ scopedFiles }) => scopedFiles.length > 0).length;
  const checkedFiles = sourceFileBuckets.reduce((sum, { scopedFiles }) => {
    return sum + scopedFiles.length;
  }, 0);

  return {
    id: 'package-responsibility-boundaries',
    errors,
    info: [
      `boundaries=${BOUNDARIES.length}`,
      `packagesChecked=${checkedPackages}`,
      `sourceFiles=${checkedFiles}`,
    ],
  };
};
