import { resolveMockExcludes } from './base.ts';
import { mergeVitestOptions } from './merge.ts';
import type { VitestBuilder, VitestConfig } from './types.ts';

const defaultIntegrationOptions: VitestConfig = {
  test: {
    include: ['tests/**/*.spec.ts'],
    exclude: [...resolveMockExcludes()],
  },
};

export const integration = (config: VitestConfig = {}): VitestBuilder => {
  return () => {
    return mergeVitestOptions(defaultIntegrationOptions, config);
  };
};
