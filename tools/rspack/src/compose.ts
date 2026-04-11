import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { RspackBuilder } from './types.ts';

export const compose = (...configs: readonly RspackBuilder[]): Configuration => {
  return configs.reduce<Configuration>((prev, curr) => {
    return mergeRspackOptions(prev, curr());
  }, {});
};
