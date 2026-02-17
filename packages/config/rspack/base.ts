/**
 * Shared Rspack base config helpers exported by `@livon/config`.
 *
 * @see https://livon.tech/docs/packages/config
 */
import { type Configuration, HtmlRspackPlugin } from '@rspack/core';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import path from 'node:path';

/**
 * Creates a reusable React-focused Rspack configuration.
 *
 * @example
 * ```ts
 * import { createRspackReactConfig } from '@livon/config/rspack';
 *
 * export default createRspackReactConfig({
 *   entry: './src/index.tsx',
 *   template: './public/index.html',
 *   port: 3000,
 * });
 * ```
 *
 * @see https://livon.tech/docs/packages/config
 */
export const createRspackReactConfig = ({
  entry,
  template,
  port = 3000,
}: {
  entry: string;
  template: string;
  port?: number;
}): Configuration => {
  return {
    mode: 'development',
    entry: {
      index: entry,
    },
    output: {
      path: path.resolve(process.cwd(), 'dist'),
    },
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
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    plugins: [
      new HtmlRspackPlugin({ template }),
      new ReactRefreshRspackPlugin(),
    ],
    stats: {
      logging: 'info',
    },
    devServer: {
      port,
      open: false,
      hot: true,
      client: {
        logging: 'info',
      },
    },
  };
};
