import { type Configuration, HtmlRspackPlugin } from '@rspack/core';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';
import path from 'node:path';

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
