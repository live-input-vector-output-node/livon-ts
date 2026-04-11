import type { Configuration } from '@rspack/core';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import { mergeRspackOptions } from './merge.ts';
import type { RspackBuilder } from './types.ts';

const defaultReactOptions: Configuration = {
  module: {
    rules: [
      {
        test: /\.(t|j)sx?$/,
        use: [
          {
            loader: 'builtin:swc-loader',
            options: {
              jsc: {
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    refresh: true,
                  },
                },
              },
            },
          },
        ],
      },
      {
        test: /\.css$/,
        type: 'css',
      },
    ],
  },
  plugins: [new ReactRefreshRspackPlugin()],
};

export const react = (config: Configuration = {}): RspackBuilder => {
  return () => {
    return mergeRspackOptions(defaultReactOptions, config);
  };
};
