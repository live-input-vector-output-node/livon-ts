import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { RspackBuilder } from './types.ts';

const defaultBrowserOptions: Configuration = {
  target: 'web',
};

export const browser = (config: Configuration = {}): RspackBuilder => {
  return () => {
    return mergeRspackOptions(defaultBrowserOptions, config);
  };
};
