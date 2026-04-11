import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { DevServerInput, RspackBuilder } from './types.ts';

const createDevServerOptions = (devServer: DevServerInput): Configuration => {
  return {
    devServer: {
      port: 3000,
      open: false,
      hot: true,
      ...devServer,
    },
  };
};

export const devServer = (
  devServerConfig: DevServerInput = {},
  config: Configuration = {},
): RspackBuilder => {
  return () => {
    const defaults = createDevServerOptions(devServerConfig);
    return mergeRspackOptions(defaults, config);
  };
};
