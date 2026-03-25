#!/usr/bin/env node

import { spawnSync } from 'node:child_process';

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'vitest',
    'bench',
    '-c',
    'vitest.bench.config.ts',
    'src/todoPerformance.bench.ts',
  ],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      LIVON_SYNC_BENCH_MATRIX_VISUAL: 'true',
    },
  },
);

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);
