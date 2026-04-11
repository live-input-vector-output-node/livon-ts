import type { RslibConfig } from '@rslib/core';
import { mergeRslibOptions } from './merge.ts';
import type { EntryInput, RslibBuilder } from './types.ts';

const createEntryOptions = ({ entries }: EntryInput): RslibConfig => {
  return {
    lib: [],
    source: {
      entry: entries,
    },
  };
};

export const entry = ({ entries }: EntryInput, config: RslibConfig = { lib: [] }): RslibBuilder => {
  return () => {
    const defaults = createEntryOptions({ entries });
    return mergeRslibOptions(defaults, config);
  };
};
