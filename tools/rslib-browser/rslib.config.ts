import { defineConfig } from '@rslib/core';

export default defineConfig({
  dev: {
    clearScreen: false,
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2021',
      dts: true,
      bundle: false,
    },
  ],
  output: {
    target: 'web',
    distPath: 'dist',
    cleanDistPath: false,
  },
});
