import { resolveMockExcludes } from './base.ts';
import { mergeVitestOptions } from './merge.ts';
import type { VitestBuilder, VitestConfig } from './types.ts';

const defaultUnitOptions: VitestConfig = {
  test: {
    include: ['src/**/*.spec.ts'],
    exclude: [...resolveMockExcludes()],
  },
};

export const unit = (config: VitestConfig = {}): VitestBuilder => {
  return () => {
    return mergeVitestOptions(defaultUnitOptions, config);
  };
};
