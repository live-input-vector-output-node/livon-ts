import type { RslibConfig } from '@rslib/core';
import { defineConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { RslibBuilder } from './types.ts';

const defaultConfig: RslibConfig = {
  lib: [],
};

export const compose = (...configs: readonly RslibBuilder[]) => {
  return defineConfig(() => {
    return configs.reduce<RslibConfig>((prev, curr) => {
      return mergeRslibOptions(prev, curr());
    }, defaultConfig);
  });
};
