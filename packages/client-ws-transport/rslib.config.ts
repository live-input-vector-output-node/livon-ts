import type { RslibConfig } from '@rslib/core';
import { browser, compose } from '@livon/rslib';

const workspaceExternals = [
  /^@livon\/client($|\/)/,
  /^@livon\/runtime($|\/)/,
];

const browserTransportBase = (): RslibConfig => {
  return {
    lib: [],
    source: {
      entry: {
        index: './src/index.ts',
      },
      tsconfigPath: './tsconfig.build.json',
    },
    output: {
      distPath: 'dist',
    },
  };
};

const browserTransportLibrary = (): RslibConfig => {
  return {
    lib: [
      {
        format: 'esm',
        syntax: 'es2021',
        dts: true,
        bundle: true,
        autoExternal: false,
      },
      {
        format: 'cjs',
        syntax: 'es2021',
        dts: true,
        bundle: true,
        autoExternal: false,
      },
    ],
    output: {
      cleanDistPath: true,
      externals: workspaceExternals,
    },
  };
};

export default compose(browserTransportBase, browserTransportLibrary, browser());
