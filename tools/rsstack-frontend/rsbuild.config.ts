import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  dev: {
    clearScreen: false,
  },
  plugins: [pluginReact()],
  html: {
    template: './public/index.html',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  output: {
    distPath: {
      root: 'dist',
    },
  },
});
