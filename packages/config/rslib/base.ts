/**
 * Shared Rslib base config helpers exported by `@livon/config`.
 *
 * @see https://livon.tech/docs/packages/config
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type ConfigParams } from '@rslib/core';

type RslibTarget = 'node' | 'web';
type RslibFormat = 'esm' | 'cjs';
type RslibEntryValue = string | readonly string[];
type RslibEntries = Readonly<Record<string, RslibEntryValue>>;

interface CreateRslibConfigInput {
  target: RslibTarget;
  formats: ReadonlyArray<RslibFormat>;
  entries?: RslibEntries;
}

interface ResolveFormatsInput {
  command: ConfigParams['command'];
  formats: ReadonlyArray<RslibFormat>;
}

interface ResolveEntriesInput {
  entries?: RslibEntries;
}

const sourceExclude = [
  /\.spec\.[cm]?[jt]sx?$/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.bench(mark)?\.[cm]?[jt]sx?$/,
  /(^|\/)__mocks__\//,
  /(^|\/)testing\//,
  /(^|\/)mocks\//,
  /(^|\/)tests?\//,
];

const defaultEntries: RslibEntries = {
  index: [
    './src/**',
    '!./src/**/*.spec.*',
    '!./src/**/*.test.*',
    '!./src/**/*.bench.*',
    '!./src/**/*.benchmark.*',
    '!./src/**/__mocks__/**',
    '!./src/**/mocks/**',
    '!./src/**/testing/**',
    '!./src/**/tests/**',
  ],
};

const resolveEntries = ({ entries }: ResolveEntriesInput): RslibEntries => entries ?? defaultEntries;

const resolveBuildTsconfigPath = (cwd: string): string | undefined =>
  existsSync(join(cwd, 'tsconfig.build.json')) ? './tsconfig.build.json' : undefined;

const resolveFormats = ({ command, formats }: ResolveFormatsInput): ReadonlyArray<RslibFormat> => {
  if (command !== 'dev') {
    return formats;
  }

  const devFormats = formats.filter((format) => format === 'esm');
  return devFormats.length > 0 ? devFormats : formats;
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
 * @see https://livon.tech/docs/packages/config
 */
export const createRslibConfig = ({ target, formats, entries }: CreateRslibConfigInput) => {
  return defineConfig(({ command }) => {
    const selectedFormats = resolveFormats({ command, formats });
    const cwd = process.cwd();
    const selectedEntries = resolveEntries({ entries });
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
        distPath: 'dist',
        cleanDistPath: command !== 'dev',
      },
    };
  });
};
