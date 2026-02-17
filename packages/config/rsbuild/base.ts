/**
 * Shared Rsbuild base config helpers exported by `@livon/config`.
 *
 * @see https://livon.tech/docs/packages/config
 */
import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

/**
 * Creates a reusable React-focused Rsbuild configuration.
 *
 * @example
 * ```ts
 * import { createRsbuildReactConfig } from '@livon/config/rsbuild';
 *
 * export default createRsbuildReactConfig({
 *   entry: './src/index.tsx',
 *   template: './public/index.html',
 * });
 * ```
 *
 * @see https://livon.tech/docs/packages/config
 */
export const createRsbuildReactConfig = ({
  entry,
  template,
}: {
  entry: string;
  template: string;
}) => {
  return defineConfig({
    dev: {
      clearScreen: false,
    },
    plugins: [pluginReact()],
    html: {
      template,
    },
    source: {
      entry: {
        index: entry,
      },
    },
    output: {
      distPath: {
        root: 'dist',
      },
    },
  });
};
