import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectSourceFiles, exists } from '../shared/fs-utils.ts';
import { normalizePath } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

const IMPORT_PATTERN = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
const DYNAMIC_IMPORT_PATTERN = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
const REQUIRE_PATTERN = /require\(\s*['"]([^'"]+)['"]\s*\)/g;

const FORBIDDEN_RUNTIME_PACKAGE_IMPORT = /^@livon\/(?:client|schema|.*transport)\b/;

const collectSpecifiers = (source: string): string[] => {
  const staticImports = [...source.matchAll(IMPORT_PATTERN)].map((match) => match[1]);
  const dynamicImports = [...source.matchAll(DYNAMIC_IMPORT_PATTERN)].map((match) => match[1]);
  const requireImports = [...source.matchAll(REQUIRE_PATTERN)].map((match) => match[1]);
  return [...new Set([...staticImports, ...dynamicImports, ...requireImports])];
};

const isCrossPackageRelativeImport = (resolvedAbsolutePath: string): boolean => {
  if (/\/apps\//.test(resolvedAbsolutePath)) {
    return true;
  }
  return /\/packages\/(?!runtime\/)/.test(resolvedAbsolutePath);
};

export const runRuntimeBoundariesCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const runtimeSourceDir = path.join(context.packagesDir, 'runtime', 'src');
  if (!(await exists(runtimeSourceDir))) {
    return {
      id: 'runtime-boundaries',
      errors: [],
      info: ['runtimeSource=missing'],
    };
  }

  const sourceFiles = await collectSourceFiles(runtimeSourceDir);
  const violations: string[] = [];

  await Promise.all(
    sourceFiles.map(async (filePath) => {
      const source = await readFile(filePath, 'utf8').catch(() => null);
      if (!source) {
        return;
      }

      const specifiers = collectSpecifiers(source);
      const relativeFilePath = normalizePath(path.relative(context.baseDir, filePath));
      specifiers.forEach((specifier) => {
        if (FORBIDDEN_RUNTIME_PACKAGE_IMPORT.test(specifier)) {
          violations.push(
            `${relativeFilePath}: forbidden runtime import "${specifier}" (runtime must stay client/schema/transport agnostic)`,
          );
          return;
        }

        if (!specifier.startsWith('.')) {
          return;
        }

        const resolvedAbsolutePath = normalizePath(path.resolve(path.dirname(filePath), specifier));
        if (isCrossPackageRelativeImport(resolvedAbsolutePath)) {
          violations.push(
            `${relativeFilePath}: forbidden cross-boundary relative import "${specifier}" (${resolvedAbsolutePath})`,
          );
        }
      });
    }),
  );

  return {
    id: 'runtime-boundaries',
    errors: violations,
    info: [`runtimeSourceFiles=${sourceFiles.length}`],
  };
};
