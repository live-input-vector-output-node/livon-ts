import { mergeEslintOptions } from './merge.ts';
import type { EslintBuilder, EslintConfig } from './types.ts';

const defaultNodeOptions: EslintConfig = {
  languageOptions: {
    parserOptions: {
      sourceType: 'module',
    },
  },
};

export const node = (options: EslintConfig = {}): EslintBuilder => {
  return () => mergeEslintOptions(defaultNodeOptions, options);
};
