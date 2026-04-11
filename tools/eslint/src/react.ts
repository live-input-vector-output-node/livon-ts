import { mergeEslintOptions } from './merge.ts';
import type { EslintBuilder, EslintConfig } from './types.ts';

const defaultReactOptions: EslintConfig = {
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
};

export const react = (options: EslintConfig = {}): EslintBuilder => {
  return () => mergeEslintOptions(defaultReactOptions, options);
};
