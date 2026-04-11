import { defineConfig } from 'vitest/config';
import { mergeVitestOptions } from './merge.ts';
import type { VitestBuilder, VitestConfig } from './types.ts';

export const compose = (...configs: readonly VitestBuilder[]) => {
  const merged = configs.reduce<VitestConfig>((prev, curr) => {
    return mergeVitestOptions(prev, curr());
  }, {});

  return defineConfig(merged);
};
