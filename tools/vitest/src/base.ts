import { mergeVitestOptions } from './merge.ts';
import type { VitestBuilder, VitestConfig } from './types.ts';

const mockExcludes = ['**/testing/mocks/**', '**/__mocks__/**'] as const;

const defaultBaseOptions: VitestConfig = {
  test: {
    environment: 'node',
    globals: false,
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      exclude: [...mockExcludes],
    },
  },
};

export const base = (config: VitestConfig = {}): VitestBuilder => {
  return () => {
    return mergeVitestOptions(defaultBaseOptions, config);
  };
};

export const resolveMockExcludes = (): readonly string[] => mockExcludes;
