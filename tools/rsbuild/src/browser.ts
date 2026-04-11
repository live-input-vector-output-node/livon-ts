import type { RsbuildConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { RsbuildBuilder } from './types.ts';

const defaultBrowserOptions: RsbuildConfig = {
  output: {
    target: 'web',
  },
};

export const browser = (config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    return mergeRsbuildOptions(defaultBrowserOptions, config);
  };
};
