import type { RsbuildConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { mergeRsbuildOptions } from './merge.ts';
import type { RsbuildBuilder } from './types.ts';

const defaultReactOptions: RsbuildConfig = {
  plugins: [pluginReact()],
};

export const react = (config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    return mergeRsbuildOptions(defaultReactOptions, config);
  };
};
