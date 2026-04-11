import { mergeEslintOptions } from './merge.ts';
import type { EslintBuilder, EslintConfig } from './types.ts';

const defaultBrowserOptions: EslintConfig = {
  languageOptions: {
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
};

export const browser = (options: EslintConfig = {}): EslintBuilder => {
  return () => mergeEslintOptions(defaultBrowserOptions, options);
};
