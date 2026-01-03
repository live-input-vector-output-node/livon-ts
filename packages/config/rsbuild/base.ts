import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

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
