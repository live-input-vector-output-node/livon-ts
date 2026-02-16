/**
 * Shared Rslib base config helpers exported by `@livon/config`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
import { existsSync, readdirSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { defineConfig, type ConfigParams } from '@rslib/core';

type RslibTarget = 'node' | 'web';
type RslibFormat = 'esm' | 'cjs';

interface CreateRslibConfigInput {
  target: RslibTarget;
  formats: ReadonlyArray<RslibFormat>;
  entries?: Readonly<Record<string, string>>;
}

interface ResolveFormatsInput {
  command: ConfigParams['command'];
  formats: ReadonlyArray<RslibFormat>;
}

interface ResolveBuildVariantInput {
  command: ConfigParams['command'];
}

interface ResolveEntriesInput {
  cwd: string;
  entries?: Readonly<Record<string, string>>;
}

const sourceFileExtensionPattern = /\.[cm]?[jt]sx?$/;
const sourceDeclarationFilePattern = /\.d\.[cm]?ts$/;

const sourceExclude = [
  /\.spec\.[cm]?[jt]sx?$/,
  /\.test\.[cm]?[jt]sx?$/,
  /(^|\/)__mocks__\//,
  /(^|\/)testing\//,
  /(^|\/)mocks\//,
  /(^|\/)tests?\//,
];

const toPosixPath = (value: string): string => value.split(sep).join('/');

const listSourceFiles = (directory: string): ReadonlyArray<string> => {
  if (!existsSync(directory)) {
    return [];
  }

  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name);
    return entry.isDirectory() ? listSourceFiles(entryPath) : [entryPath];
  });
};

const isExcludedSourceFile = (sourceFilePath: string): boolean =>
  sourceExclude.some((pattern) => pattern.test(toPosixPath(sourceFilePath)));

const isBuildSourceFile = (sourceFilePath: string): boolean =>
  sourceFileExtensionPattern.test(sourceFilePath) && !sourceDeclarationFilePattern.test(sourceFilePath);

const toEntryKey = (sourceRootPath: string, sourceFilePath: string): string =>
  toPosixPath(relative(sourceRootPath, sourceFilePath)).replace(sourceFileExtensionPattern, '');

const toEntryValue = (cwd: string, sourceFilePath: string): string =>
  `./${toPosixPath(relative(cwd, sourceFilePath))}`;

const resolveEntries = ({ cwd, entries }: ResolveEntriesInput): Readonly<Record<string, string>> => {
  const sourceRootPath = join(cwd, 'src');
  const discoveredEntries = listSourceFiles(sourceRootPath)
    .filter(isBuildSourceFile)
    .filter((sourceFilePath) => !isExcludedSourceFile(sourceFilePath))
    .sort((left, right) => left.localeCompare(right))
    .reduce<Record<string, string>>((acc, sourceFilePath) => {
      return {
        ...acc,
        [toEntryKey(sourceRootPath, sourceFilePath)]: toEntryValue(cwd, sourceFilePath),
      };
    }, {});

  const defaultEntries = Object.keys(discoveredEntries).length > 0 ? discoveredEntries : { index: './src/index.ts' };
  return {
    ...defaultEntries,
    ...entries,
  };
};

const resolveBuildTsconfigPath = (cwd: string): string | undefined =>
  existsSync(join(cwd, 'tsconfig.build.json')) ? './tsconfig.build.json' : undefined;

const resolveFormats = ({ command, formats }: ResolveFormatsInput): ReadonlyArray<RslibFormat> => {
  if (command !== 'dev') {
    return formats;
  }

  const devFormats = formats.filter((format) => format === 'esm');
  return devFormats.length > 0 ? devFormats : formats;
};

const resolveBuildVariant = ({ command }: ResolveBuildVariantInput): 'dev' | 'default' | 'mini' => {
  if (command === 'dev') {
    return 'dev';
  }
  return process.env.LIVON_BUILD_VARIANT === 'mini' ? 'mini' : 'default';
};

/**
 * Creates a reusable Rslib configuration with deterministic dev format selection.
 *
 * @example
 * ```ts
 * import { createRslibConfig } from '@livon/config/rslib';
 *
 * export default createRslibConfig({
 *   target: 'node',
 *   formats: ['esm', 'cjs'],
 * });
 * ```
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
export const createRslibConfig = ({ target, formats, entries }: CreateRslibConfigInput) => {
  return defineConfig(({ command }) => {
    const selectedFormats = resolveFormats({ command, formats });
    const buildVariant = resolveBuildVariant({ command });
    const shouldMinify = buildVariant === 'mini';
    const outputDistPath = buildVariant === 'mini' ? 'dist/mini' : 'dist';
    const cwd = process.cwd();
    const selectedEntries = resolveEntries({ cwd, entries });
    const selectedTsconfigPath = resolveBuildTsconfigPath(cwd);

    return {
      dev: {
        clearScreen: false,
      },
      source: {
        entry: selectedEntries,
        exclude: sourceExclude,
        ...(selectedTsconfigPath ? { tsconfigPath: selectedTsconfigPath } : {}),
      },
      lib: selectedFormats.map((format) => {
        return {
          format,
          syntax: 'es2021',
          dts: true,
          bundle: false,
        };
      }),
      output: {
        target,
        distPath: outputDistPath,
        cleanDistPath: false,
        minify: shouldMinify,
      },
    };
  });
};
