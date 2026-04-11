import { mergeEslintOptions } from './merge.ts';
import type { EslintBuilder, EslintConfig } from './types.ts';

export const compose = (...layers: readonly EslintBuilder[]): readonly EslintConfig[] => {
  const merged = layers
    .map((layer) => layer())
    .reduce<EslintConfig>((acc, current) => mergeEslintOptions(acc, current), {});

  const globalIgnores: EslintConfig = {
    ignores: merged.ignores ?? [],
  };

  return [globalIgnores, merged];
};
