/**
 * Shared Vitest base config helpers exported by `@livon/config/vitest/base.cjs`.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 */

/**
 * Creates a reusable Vitest config for unit or integration projects.
 *
 * @example
 * ```js
 * const { createVitestConfig } = require('@livon/config/vitest/base.cjs');
 *
 * module.exports = createVitestConfig({ type: 'unit' });
 * ```
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/packages/config
 *
 * @param {{ type: 'unit' | 'integration' }} input
 * @returns {{
 *   test: {
 *     include: string[];
 *     exclude: string[];
 *     environment: string;
 *     globals: boolean;
 *     coverage: {
 *       provider: string;
 *       reporter: string[];
 *       exclude: string[];
 *     };
 *   };
 * }}
 */
const createVitestConfig = (input) => {
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

module.exports = {
  createVitestConfig,
};
