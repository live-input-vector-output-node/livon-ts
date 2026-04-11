import type { RsbuildConfig } from '@rsbuild/core';
import { defineConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { RsbuildBuilder } from './types.ts';

export const compose = (...configs: readonly RsbuildBuilder[]) => {
  const merged = configs.reduce<RsbuildConfig>((prev, curr) => {
    return mergeRsbuildOptions(prev, curr());
  }, {});

  return defineConfig(merged);
};
