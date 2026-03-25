#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const coverageDirectoryPath = path.resolve('coverage/bench');
const summaryPath = path.join(coverageDirectoryPath, 'strategy-matrix-summary.json');

const variants = [
  {
    label: 'batch:on subview:on',
    key: 'batch-on_subview-on',
    batch: true,
    subview: true,
  },
  {
    label: 'batch:on subview:off',
    key: 'batch-on_subview-off',
    batch: true,
    subview: false,
  },
  {
    label: 'batch:off subview:on',
    key: 'batch-off_subview-on',
    batch: false,
    subview: true,
  },
  {
    label: 'batch:off subview:off',
    key: 'batch-off_subview-off',
    batch: false,
    subview: false,
  },
];

const runBenchVariant = ({ batch, key, subview }) => {
  const reportPath = path.join(coverageDirectoryPath, `report.matrix.${key}.json`);
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
        LIVON_SYNC_BENCH_BATCH: String(batch),
        LIVON_SYNC_BENCH_SUBVIEW: String(subview),
      },
    },
  );

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }

  return reportPath;
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

const formatMs = (value) => {
  return `${(value ?? 0).toFixed(6)}ms`;
};

const formatHz = (value) => {
  return `${(value ?? 0).toFixed(2)}hz`;
};

const formatDelta = (value) => {
  if (value === 0) {
    return 'best';
  }

  if (value < 0) {
    return `${value.toFixed(2)}%`;
  }

  return `+${value.toFixed(2)}%`;
};

fs.mkdirSync(coverageDirectoryPath, { recursive: true });

const benchmarkByVariantKey = new Map();

variants.forEach((variant) => {
  const reportPath = runBenchVariant(variant);
  const report = readJson(reportPath);
  const benchmarks = flattenBenchmarks(report);
  benchmarkByVariantKey.set(variant.key, benchmarks);
});

const benchmarkNames = Array.from(
  new Set(
    variants.flatMap((variant) => {
      const benchmarks = benchmarkByVariantKey.get(variant.key) ?? [];
      return benchmarks.map((entry) => entry.name);
    }),
  ),
).sort((left, right) => left.localeCompare(right));

const summary = [];
const winsByVariantKey = new Map(variants.map((variant) => [variant.key, 0]));

benchmarkNames.forEach((benchmarkName) => {
  const rows = variants.map((variant) => {
    const benchmark = (benchmarkByVariantKey.get(variant.key) ?? []).find((entry) => {
      return entry.name === benchmarkName;
    });

    if (!benchmark) {
      throw new Error(`Missing benchmark '${benchmarkName}' for variant '${variant.label}'`);
    }

    return {
      key: variant.key,
      label: variant.label,
      mean: benchmark.mean,
      hz: benchmark.hz,
      p99: benchmark.p99,
    };
  });

  const bestRow = rows.reduce((best, current) => {
    if (!best) {
      return current;
    }

    if (current.mean < best.mean) {
      return current;
    }

    if (current.mean === best.mean && current.hz > best.hz) {
      return current;
    }

    return best;
  }, null);

  if (!bestRow) {
    return;
  }

  winsByVariantKey.set(
    bestRow.key,
    (winsByVariantKey.get(bestRow.key) ?? 0) + 1,
  );

  const rowsWithDelta = rows.map((row) => {
    const meanDeltaPercent = bestRow.mean === 0
      ? 0
      : ((row.mean - bestRow.mean) / bestRow.mean) * 100;

    return {
      ...row,
      meanDeltaPercent,
    };
  });

  summary.push({
    benchmarkName,
    bestVariant: bestRow.label,
    rows: rowsWithDelta,
  });
});

fs.writeFileSync(summaryPath, JSON.stringify({
  wins: variants.map((variant) => {
    return {
      variant: variant.label,
      winCount: winsByVariantKey.get(variant.key) ?? 0,
    };
  }),
  summary,
}, null, 2));

console.log('\nStrategy matrix summary (lower mean is better):');
summary.forEach((entry) => {
  console.log(`\n${entry.benchmarkName}`);
  entry.rows
    .sort((left, right) => left.mean - right.mean)
    .forEach((row) => {
      console.log(
        `- ${row.label} | mean ${formatMs(row.mean)} (${formatDelta(row.meanDeltaPercent)}) | p99 ${formatMs(row.p99)} | ${formatHz(row.hz)}`,
      );
    });
});

console.log('\nVariant wins:');
variants.forEach((variant) => {
  console.log(`- ${variant.label}: ${winsByVariantKey.get(variant.key) ?? 0}`);
});

console.log(`\nWrote matrix summary to ${summaryPath}`);
