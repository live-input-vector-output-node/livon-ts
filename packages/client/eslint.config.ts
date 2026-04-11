import { base, compose, node } from '@livon/eslint';

export default compose(
  base(),
  node({
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      'templates/**/*.template.ts',
    ],
  }),
);
