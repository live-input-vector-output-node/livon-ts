import type { RsbuildConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { RsbuildBuilder } from './types.ts';

const defaultBaseOptions: RsbuildConfig = {
  output: {
    distPath: {
      root: 'dist',
    },
  },
};

export const base = (config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    return mergeRsbuildOptions(defaultBaseOptions, config);
  };
};
