import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { RslibBuilder } from './types.ts';

const defaultReactOptions: RslibConfig = {
  lib: [],
  output: {
    target: 'web',
  },
};

export const react = (config: RslibConfig = { lib: [] }): RslibBuilder => {
  return () => {
    return mergeRslibOptions(defaultReactOptions, config);
  };
};
