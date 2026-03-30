#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const coverageDirectoryPath = path.resolve('coverage/bench');
const summaryPath = path.join(coverageDirectoryPath, 'execution-mode-summary.json');
const BENCH_TODO_COUNT = 10_000;

const executionModes = [
  'parallel',
  'sequential',
];

const runBenchMode = ({
  mode,
  reportPath,
}) => {
  const result = spawnSync(
    'pnpm',
    [
      'exec',
      'vitest',
      'bench',
      '-c',
      'vitest.bench.config.ts',
      'src/todoPerformance.bench.ts',
      '--outputJson',
      reportPath,
    ],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: false,
      env: {
        ...process.env,
        LIVON_SYNC_BENCH_EXECUTION_MODE: mode,
        LIVON_SYNC_BENCH_EXECUTION_MODE_MATRIX: 'false',
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const readJson = (targetPath) => {
  const raw = fs.readFileSync(targetPath, 'utf8');
  return JSON.parse(raw);
};

const flattenBenchmarks = (report) => {
  const files = Array.isArray(report.files) ? report.files : [];
  return files.flatMap((file) => {
    const groups = Array.isArray(file.groups) ? file.groups : [];
    return groups.flatMap((group) => {
      const benchmarks = Array.isArray(group.benchmarks) ? group.benchmarks : [];
      return benchmarks.map((benchmark) => {
        return {
          name: benchmark.name,
          mean: benchmark.mean,
          hz: benchmark.hz,
          p99: benchmark.p99,
        };
      });
    });
  });
};

const formatPercent = (value) => {
  if (value === 0) {
    return '0.00%';
  }

  if (value < 0) {
    return `${value.toFixed(2)}%`;
  }

  return `+${value.toFixed(2)}%`;
};

const formatMs = (value) => {
  return `${(value ?? 0).toFixed(6)}ms`;
};

const getByBenchmarkName = (benchmarks, name) => {
  return benchmarks.find((entry) => {
    return entry.name === name;
  });
};

fs.mkdirSync(coverageDirectoryPath, { recursive: true });

const reportByMode = new Map();
executionModes.forEach((mode) => {
  const reportPath = path.join(coverageDirectoryPath, `report.execution-mode.${mode}.json`);
  runBenchMode({
    mode,
    reportPath,
  });
  const report = readJson(reportPath);
  reportByMode.set(mode, flattenBenchmarks(report));
});

const parallelBenchmarks = reportByMode.get('parallel') ?? [];
const sequentialBenchmarks = reportByMode.get('sequential') ?? [];

const benchmarkNames = Array.from(
  new Set([
    ...parallelBenchmarks.map((benchmark) => benchmark.name),
    ...sequentialBenchmarks.map((benchmark) => benchmark.name),
  ]),
).sort((left, right) => left.localeCompare(right));

const comparisonRows = benchmarkNames.map((benchmarkName) => {
  const parallelBenchmark = getByBenchmarkName(parallelBenchmarks, benchmarkName);
  const sequentialBenchmark = getByBenchmarkName(sequentialBenchmarks, benchmarkName);
  if (!parallelBenchmark || !sequentialBenchmark) {
    throw new Error(`Missing benchmark '${benchmarkName}' in one execution mode report.`);
  }

  const meanDeltaPercent = sequentialBenchmark.mean === 0
    ? 0
    : ((parallelBenchmark.mean - sequentialBenchmark.mean) / sequentialBenchmark.mean) * 100;

  return {
    benchmarkName,
    meanDeltaPercent,
    fasterMode: parallelBenchmark.mean < sequentialBenchmark.mean ? 'parallel' : 'sequential',
    parallel: {
      mean: parallelBenchmark.mean,
      hz: parallelBenchmark.hz,
      p99: parallelBenchmark.p99,
    },
    sequential: {
      mean: sequentialBenchmark.mean,
      hz: sequentialBenchmark.hz,
      p99: sequentialBenchmark.p99,
    },
  };
});

const wins = comparisonRows.reduce((result, row) => {
  result[row.fasterMode] = (result[row.fasterMode] ?? 0) + 1;
  return result;
}, {
  parallel: 0,
  sequential: 0,
});

const meanDeltaAveragePercent = comparisonRows.length === 0
  ? 0
  : comparisonRows.reduce((sum, row) => {
    return sum + row.meanDeltaPercent;
  }, 0) / comparisonRows.length;

const summary = {
  generatedAt: new Date().toISOString(),
  todoCount: BENCH_TODO_COUNT,
  wins,
  meanDeltaAveragePercent,
  rows: comparisonRows,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log(`\nExecution mode comparison (parallel vs sequential, todoCount=${BENCH_TODO_COUNT}):`);
comparisonRows.forEach((row) => {
  console.log(`\n${row.benchmarkName}`);
  console.log(`- parallel   | mean ${formatMs(row.parallel.mean)} | p99 ${formatMs(row.parallel.p99)} | ${(row.parallel.hz ?? 0).toFixed(2)}hz`);
  console.log(`- sequential | mean ${formatMs(row.sequential.mean)} | p99 ${formatMs(row.sequential.p99)} | ${(row.sequential.hz ?? 0).toFixed(2)}hz`);
  console.log(`- delta (parallel vs sequential): ${formatPercent(row.meanDeltaPercent)} | faster: ${row.fasterMode}`);
});

console.log('\nMode wins:');
console.log(`- parallel: ${wins.parallel}`);
console.log(`- sequential: ${wins.sequential}`);
console.log(`- average mean delta (parallel vs sequential): ${formatPercent(meanDeltaAveragePercent)}`);
console.log(`\nWrote execution-mode summary to ${summaryPath}`);
