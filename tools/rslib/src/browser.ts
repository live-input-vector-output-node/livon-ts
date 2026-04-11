import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { RslibBuilder } from './types.ts';

const defaultBrowserOptions: RslibConfig = {
  lib: [],
  output: {
    target: 'web',
  },
};

export const browser = (config: RslibConfig = { lib: [] }): RslibBuilder => {
  return () => {
    return mergeRslibOptions(defaultBrowserOptions, config);
  };
};
