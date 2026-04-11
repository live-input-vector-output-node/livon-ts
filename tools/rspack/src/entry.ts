import type { Configuration } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { EntryInput, RspackBuilder } from './types.ts';

const createEntryOptions = (index: EntryInput['index']): Configuration => {
  return {
    entry: {
      index,
    },
  };
};

export const entry = (index: EntryInput['index'], config: Configuration = {}): RspackBuilder => {
  return () => {
    const defaults = createEntryOptions(index);
    return mergeRspackOptions(defaults, config);
  };
};
