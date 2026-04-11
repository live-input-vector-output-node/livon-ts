import type { RsbuildConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { RsbuildBuilder } from './types.ts';

const defaultNodeOptions: RsbuildConfig = {
  output: {
    target: 'node',
  },
};

export const node = (config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    return mergeRsbuildOptions(defaultNodeOptions, config);
  };
};
