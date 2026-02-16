import { HtmlRspackPlugin } from '@rspack/core';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ReactRefreshRspackPlugin from '@rspack/plugin-react-refresh';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
  mode: 'development',
  experiments: {
    css: true,
  },
  entry: {
    index: './src/index.tsx',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
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
    new HtmlRspackPlugin({ template: './public/index.html' }),
    new ReactRefreshRspackPlugin(),
  ],
  stats: {
    logging: 'info',
  },
  devServer: {
    port: 3000,
    open: false,
    hot: true,
    client: {
      logging: 'info',
    },
  },
};

export default config;
