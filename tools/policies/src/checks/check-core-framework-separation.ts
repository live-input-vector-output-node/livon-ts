import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectSourceFiles, exists } from '../shared/fs-utils.ts';
import { normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const FRAMEWORK_PACKAGE_NAMES = ['react', 'angular', 'svelte'] as const;
const CORE_TRACKING_FILE_NAMES = new Set([
  'listenerCounter',
  'destroyScheduler',
  'snapshotStore',
  'resetUnitTracking',
  'subscribeTrackedUnit',
  'resetTrackedUnit',
]);
const CORE_TRACKING_SYMBOLS = [
  'addTrackedUnitListener',
  'removeTrackedUnitListener',
  'clearTrackedUnitListeners',
  'scheduleTrackedUnitDestroy',
  'clearPendingTrackedUnitDestroy',
  'readTrackedUnitSnapshot',
  'writeTrackedUnitSnapshot',
  'resetTrackedUnit',
  'subscribeTrackedUnit',
];
const TEST_FILE_PATTERN = /\.(?:spec|test)\.[cm]?[jt]sx?$/;
const TEST_PATH_SEGMENTS = ['/testing/', '/__tests__/', '/test/'];

interface FrameworkFileInput {
  filePath: string;
  relativePath: string;
}

interface FrameworkPackageCheckResult {
  packageName: string;
  exists: boolean;
  sourceFilesCount: number;
  errors: string[];
}

const isTestLikeFile = (relativePath: string): boolean => {
  if (TEST_FILE_PATTERN.test(relativePath)) {
    return true;
  }

  return TEST_PATH_SEGMENTS.some((segment) => relativePath.includes(segment));
};

const collectDeclarationViolations = (source: string): string[] => {
  return CORE_TRACKING_SYMBOLS
    .map((symbol) => {
      const declarationPattern = new RegExp(
        String.raw`(?:^|\n)\s*(?:export\s+)?(?:const|let|var|type|interface)\s+${symbol}\b`,
      );

      return declarationPattern.test(source) ? symbol : null;
    })
    .filter((value): value is string => value !== null);
};

const checkFrameworkFile = async ({ filePath, relativePath }: FrameworkFileInput): Promise<string[]> => {
  const errors: string[] = [];
  const baseName = path.basename(filePath).replace(/\.[^.]+$/, '');

  if (CORE_TRACKING_FILE_NAMES.has(baseName)) {
    errors.push(
      `${relativePath}: file "${baseName}" is core tracking logic and must live in @livon/sync instead of framework adapters`,
    );
  }

  const source = await readFile(filePath, 'utf8').catch(() => null);
  if (!source) {
    return errors;
  }

  const declarationViolations = collectDeclarationViolations(source);
  if (declarationViolations.length === 0) {
    return errors;
  }

  errors.push(
    `${relativePath}: core tracking symbols must not be declared in framework adapter packages (${declarationViolations.join(', ')})`,
  );

  return errors;
};

export const runCoreFrameworkSeparationCheck = async (
  context: PolicyContext,
): Promise<PolicyCheckResult> => {
  const packageResults: readonly FrameworkPackageCheckResult[] = await Promise.all(
    FRAMEWORK_PACKAGE_NAMES.map(async (packageName) => {
      const sourceDir = path.join(context.packagesDir, packageName, 'src');
      if (!(await exists(sourceDir))) {
        return {
          packageName,
          exists: false,
          sourceFilesCount: 0,
          errors: [],
        };
      }

      const sourceFiles = await collectSourceFiles(sourceDir);
      const scopedFiles = sourceFiles
        .map((filePath) => normalizePath(path.relative(context.baseDir, filePath)))
        .filter((relativePath) => !isTestLikeFile(relativePath))
        .map((relativePath) => ({
          relativePath,
          filePath: path.join(context.baseDir, relativePath),
        }));

      const fileErrors = await Promise.all(
        scopedFiles.map((entry) => {
          return checkFrameworkFile(entry);
        }),
      );

      return {
        packageName,
        exists: true,
        sourceFilesCount: scopedFiles.length,
        errors: fileErrors.flat(),
      };
    }),
  );

  const existingPackages = packageResults
    .filter((result) => result.exists)
    .map((result) => result.packageName);
  const frameworkSourceFiles = packageResults.reduce((sum, result) => {
    return sum + result.sourceFilesCount;
  }, 0);
  const errors = packageResults.flatMap((result) => result.errors);

  return {
    id: 'core-framework-separation',
    errors,
    info: [
      `frameworkPackages=${existingPackages.length}`,
      `frameworkSourceFiles=${frameworkSourceFiles}`,
      `packagesChecked=${FRAMEWORK_PACKAGE_NAMES.length}`,
    ],
  };
};
