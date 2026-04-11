import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { RslibBuilder } from './types.ts';

const defaultNodeOptions: RslibConfig = {
  lib: [],
  output: {
    target: 'node',
  },
};

export const node = (config: RslibConfig = { lib: [] }): RslibBuilder => {
  return () => {
    return mergeRslibOptions(defaultNodeOptions, config);
  };
};
