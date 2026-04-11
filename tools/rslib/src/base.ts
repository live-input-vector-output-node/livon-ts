import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { RslibBuilder } from './types.ts';

const sourceExclude = [
  /\.spec\.[cm]?[jt]sx?$/,
  /\.test\.[cm]?[jt]sx?$/,
  /\.bench(mark)?\.[cm]?[jt]sx?$/,
  /(^|\/)__mocks__\//,
  /(^|\/)testing\//,
  /(^|\/)mocks\//,
  /(^|\/)tests?\//,
];

const defaultEntries = {
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

const defaultBaseOptions = (cwd: string): RslibConfig => {
  const tsconfigPath = existsSync(join(cwd, 'tsconfig.build.json'))
    ? './tsconfig.build.json'
    : undefined;

  return {
    lib: [],
    source: {
      entry: defaultEntries,
      exclude: sourceExclude,
      ...(tsconfigPath ? { tsconfigPath } : {}),
    },
    output: {
      distPath: 'dist',
    },
  };
};

export const base = (config: RslibConfig = { lib: [] }): RslibBuilder => {
  return () => {
    const cwd = process.cwd();
    const defaults = defaultBaseOptions(cwd);

    return mergeRslibOptions(defaults, config);
  };
};
