import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { PackageJsonLike } from '../../shared/types.ts';
import { exists } from '../../shared/fs-utils.ts';

interface ExportConditionMap {
  readonly types?: unknown;
  readonly import?: unknown;
  readonly require?: unknown;
}

interface PackageJsonWithExports extends PackageJsonLike {
  readonly main?: unknown;
  readonly module?: unknown;
  readonly types?: unknown;
  readonly exports?: unknown;
}

interface PublicEntrypoint {
  readonly subpath: string;
  readonly distSubpath: string;
}

const EXPORT_FROM_LOCAL_FILE_PATTERN = /^export[\s\S]*?from\s+['"]\.\/([^'"]+)\.js['"];?$/gm;

const readPublicEntrypointsFromIndex = (source: string): readonly PublicEntrypoint[] => {
  const entrypoints = new Map<string, PublicEntrypoint>();
  const matches = source.matchAll(EXPORT_FROM_LOCAL_FILE_PATTERN);

  for (const match of matches) {
    const modulePath = match[1];
    if (!modulePath) {
      continue;
    }
    const subpath = modulePath.endsWith('/index')
      ? modulePath.slice(0, -'/index'.length)
      : modulePath;
    if (!subpath || subpath === 'index') {
      continue;
    }
    entrypoints.set(subpath, {
      subpath,
      distSubpath: modulePath,
    });
  }

  return [...entrypoints.values()].sort((left, right) => left.subpath.localeCompare(right.subpath));
};

const isConditionMap = (value: unknown): value is ExportConditionMap =>
  typeof value === 'object' && value !== null;

const normalizeExportsMap = (exportsField: unknown): Record<string, unknown> | null => {
  if (typeof exportsField !== 'object' || exportsField === null || Array.isArray(exportsField)) {
    return null;
  }
  return exportsField as Record<string, unknown>;
};

interface ValidateExportEntryInput {
  projectPath: string;
  exportKey: string;
  exportValue: unknown;
  expectedTypesPath: string;
  expectedImportPath: string;
  expectedRequirePath: string;
}

const validateExportEntry = ({
  projectPath,
  exportKey,
  exportValue,
  expectedTypesPath,
  expectedImportPath,
  expectedRequirePath,
}: ValidateExportEntryInput): string[] => {
  if (!isConditionMap(exportValue)) {
    return [`${projectPath}: exports["${exportKey}"] must be an object with types/import/require`];
  }

  const errors: string[] = [];

  if (exportValue.types !== expectedTypesPath) {
    errors.push(
      `${projectPath}: exports["${exportKey}"].types must be "${expectedTypesPath}"`,
    );
  }

  if (exportValue.import !== expectedImportPath) {
    errors.push(
      `${projectPath}: exports["${exportKey}"].import must be "${expectedImportPath}"`,
    );
  }

  if (exportValue.require !== expectedRequirePath) {
    errors.push(
      `${projectPath}: exports["${exportKey}"].require must be "${expectedRequirePath}"`,
    );
  }

  return errors;
};

const isLivonPackage = (pkgJson: PackageJsonLike): boolean =>
  typeof pkgJson.name === 'string' && pkgJson.name.startsWith('@livon/');

export const checkPackageExports = async (
  pkgJson: PackageJsonLike,
  projectPath: string,
): Promise<string[]> => {
  if (!isLivonPackage(pkgJson)) {
    return [];
  }

  const typedPackageJson = pkgJson as PackageJsonWithExports;
  if (
    typeof typedPackageJson.main !== 'string'
    || typeof typedPackageJson.module !== 'string'
    || typeof typedPackageJson.types !== 'string'
  ) {
    return [];
  }

  const exportsMap = normalizeExportsMap(typedPackageJson.exports);
  if (!exportsMap) {
    return [`${projectPath}: package.json exports must be an object`];
  }

  const errors: string[] = [];
  errors.push(
    ...validateExportEntry({
      projectPath,
      exportKey: '.',
      exportValue: exportsMap['.'],
      expectedTypesPath: typedPackageJson.types,
      expectedImportPath: typedPackageJson.module,
      expectedRequirePath: typedPackageJson.main,
    }),
  );

  const indexPath = path.join(projectPath, 'src', 'index.ts');
  if (!(await exists(indexPath))) {
    return errors;
  }

  const indexSource = await readFile(indexPath, 'utf8');
  const entrypoints = readPublicEntrypointsFromIndex(indexSource);
  entrypoints.forEach(({ subpath, distSubpath }) => {
    const expectedBasePath = `./dist/${distSubpath}`;
    errors.push(
      ...validateExportEntry({
        projectPath,
        exportKey: `./${subpath}`,
        exportValue: exportsMap[`./${subpath}`],
        expectedTypesPath: `${expectedBasePath}.d.ts`,
        expectedImportPath: `${expectedBasePath}.js`,
        expectedRequirePath: `${expectedBasePath}.cjs`,
      }),
    );
  });

  return errors;
};
