/**
 * Shared Vitest base config helpers exported by `@livon/config`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
type VitestProjectType = 'unit' | 'integration';

export interface VitestConfigInput {
  type: VitestProjectType;
}

export interface VitestCoverageConfig {
  provider: string;
  reporter: string[];
  exclude: string[];
}

export interface VitestTestConfig {
  include: string[];
  exclude: string[];
  environment: string;
  globals: boolean;
  coverage: VitestCoverageConfig;
}

export interface VitestConfig {
  test: VitestTestConfig;
}

/**
 * Creates a reusable Vitest config for unit or integration projects.
 *
 * @example
 * ```ts
 * import { createVitestConfig } from '@livon/config/vitest';
 *
 * export default createVitestConfig({ type: 'unit' });
 * ```
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */
export const createVitestConfig = (input: VitestConfigInput): VitestConfig => {
  const mockExcludes = ['**/testing/mocks/**', '**/__mocks__/**'];

  return {
    test: {
      include: input.type === 'unit' ? ['src/**/*.spec.ts'] : ['tests/**/*.spec.ts'],
      exclude: mockExcludes,
      environment: 'node',
      globals: false,
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        exclude: mockExcludes,
      },
    },
  };
};
