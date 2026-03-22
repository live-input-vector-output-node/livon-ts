#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import path from 'node:path';

const runCommand = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  return 1;
};

const reportPath = 'coverage/bench/report.json';
const thresholdsPath = 'benchmarks/todo-thresholds.json';
const checkScriptPath = path.resolve('scripts/check-bench-thresholds.mjs');

const benchStatus = runCommand('pnpm', [
  'exec',
  'vitest',
  'bench',
  '-c',
  'vitest.bench.config.ts',
  '--outputJson',
  reportPath,
]);

if (benchStatus !== 0) {
  process.exit(benchStatus);
}

const gateStatus = runCommand('node', [checkScriptPath, reportPath, thresholdsPath]);
process.exit(gateStatus);
