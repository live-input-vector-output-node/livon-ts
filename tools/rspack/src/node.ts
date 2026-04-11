import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { RspackBuilder } from './types.ts';

const defaultNodeOptions: Configuration = {
  target: 'node',
};

export const node = (config: Configuration = {}): RspackBuilder => {
  return () => {
    return mergeRspackOptions(defaultNodeOptions, config);
  };
};
