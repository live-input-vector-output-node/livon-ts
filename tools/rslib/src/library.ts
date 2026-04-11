import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { LibraryInput, RslibBuilder, RslibFormats } from './types.ts';

const createLibraryOptions = ({ formats }: { formats: RslibFormats }): RslibConfig => {
  return {
    lib: formats.map((format) => {
      return {
        format,
        syntax: 'es2021',
        dts: true,
        bundle: false,
      };
    }),
    output: {
      cleanDistPath: true,
    },
  };
};

export const library = (
  { formats = ['esm', 'cjs'] }: LibraryInput = {},
  config: RslibConfig = { lib: [] },
): RslibBuilder => {
  return () => {
    const defaults = createLibraryOptions({ formats });
    return mergeRslibOptions(defaults, config);
  };
};
