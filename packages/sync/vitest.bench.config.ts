import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    benchmark: {
      include: ['src/**/*.bench.ts'],
      includeSamples: false,
      outputJson: 'coverage/bench/report.json',
      reporters: ['default'],
    },
  },
});
