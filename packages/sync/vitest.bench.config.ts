import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
    benchmark: {
      include: ['src/**/*.bench.ts'],
      includeSamples: true,
      outputJson: 'coverage/bench/report.json',
      reporters: ['default'],
    },
  },
});
