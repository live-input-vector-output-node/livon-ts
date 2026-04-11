import { resolve } from 'node:path';
import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { RspackBuilder } from './types.ts';

const defaultBaseOptions: Configuration = {
  mode: 'development',
  experiments: {
    css: true,
  },
  output: {
    path: resolve(process.cwd(), 'dist'),
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js'],
  },
  stats: {
    logging: 'info',
  },
};

export const base = (config: Configuration = {}): RspackBuilder => {
  return () => {
    return mergeRspackOptions(defaultBaseOptions, config);
  };
};
