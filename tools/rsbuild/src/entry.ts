import type { RsbuildConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { EntryInput, RsbuildBuilder } from './types.ts';

const createEntryOptions = (index: EntryInput['index']): RsbuildConfig => {
  return {
    source: {
      entry: {
        index,
      },
    },
  };
};

export const entry = (index: EntryInput['index'], config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    const defaults = createEntryOptions(index);
    return mergeRsbuildOptions(defaults, config);
  };
};
