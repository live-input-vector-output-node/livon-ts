#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const coverageDirectoryPath = path.resolve('coverage/bench/adaptive-matrix');
const summaryPath = path.join(coverageDirectoryPath, 'summary.json');
const runtimeMatrixPath = path.resolve('src/utils/adaptiveReadWriteMatrix.json');
const benchmarksMatrixPath = path.resolve('benchmarks/adaptive-read-write-matrix.json');

const readWriteVariants = [
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

const profiles = [
  {
    key: 'cache-off-lru-off',
    cacheEnabled: false,
    lruMaxEntries: 0,
  },
  {
    key: 'cache-off-lru-on',
    cacheEnabled: false,
    lruMaxEntries: 256,
  },
  {
    key: 'cache-on-lru-off',
    cacheEnabled: true,
    lruMaxEntries: 0,
  },
  {
    key: 'cache-on-lru-on',
    cacheEnabled: true,
    lruMaxEntries: 256,
  },
];

const operationBenchmarkNameByOperation = {
  readOne: 'todo entity read by id after 10_000 seed',
  readMany: 'todo source get 10_000 entries',
  updateOne: 'todo entity write upsert one after 10_000 seed',
  updateMany: 'todo entity write upsert many(64) after 10_000 seed',
  setOne: 'todo transform set access after 10_000 seed',
  setMany: 'todo source set many(64) access after 10_000 seed',
};

const operations = Object.keys(operationBenchmarkNameByOperation);

const runBenchVariant = ({
  profile,
  variant,
}) => {
  const reportPath = path.join(
    coverageDirectoryPath,
    `report.${profile.key}.${variant.key}.json`,
  );
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
        LIVON_SYNC_BENCH_BATCH: String(variant.batch),
        LIVON_SYNC_BENCH_SUBVIEW: String(variant.subview),
        LIVON_SYNC_BENCH_CACHE_ENABLED: String(profile.cacheEnabled),
        LIVON_SYNC_BENCH_CACHE_LRU_MAX_ENTRIES: String(profile.lruMaxEntries),
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

const formatPercent = (value) => {
  if (value === 0) {
    return 'best';
  }

  if (value < 0) {
    return `${value.toFixed(2)}%`;
  }

  return `+${value.toFixed(2)}%`;
};

fs.mkdirSync(coverageDirectoryPath, { recursive: true });

const benchmarksByProfileAndVariant = new Map();

profiles.forEach((profile) => {
  readWriteVariants.forEach((variant) => {
    const reportPath = runBenchVariant({
      profile,
      variant,
    });
    const report = readJson(reportPath);
    const benchmarks = flattenBenchmarks(report);
    benchmarksByProfileAndVariant.set(
      `${profile.key}:${variant.key}`,
      benchmarks,
    );
  });
});

const runtimeProfiles = {};
const summaryProfiles = {};

profiles.forEach((profile) => {
  const perOperation = {};

  operations.forEach((operation) => {
    const benchmarkName = operationBenchmarkNameByOperation[operation];
    const rows = readWriteVariants.map((variant) => {
      const benchmarks = benchmarksByProfileAndVariant.get(
        `${profile.key}:${variant.key}`,
      ) ?? [];
      const benchmark = benchmarks.find((entry) => {
        return entry.name === benchmarkName;
      });
      if (!benchmark) {
        throw new Error(
          `Missing benchmark '${benchmarkName}' for profile '${profile.key}' and variant '${variant.key}'.`,
        );
      }

      return {
        key: variant.key,
        label: variant.label,
        batch: variant.batch,
        subview: variant.subview,
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

    const rowsWithDelta = rows.map((row) => {
      const meanDeltaPercent = bestRow.mean === 0
        ? 0
        : ((row.mean - bestRow.mean) / bestRow.mean) * 100;

      return {
        ...row,
        meanDeltaPercent,
      };
    });

    perOperation[operation] = {
      benchmarkName,
      bestVariantKey: bestRow.key,
      bestVariantLabel: bestRow.label,
      best: {
        batch: bestRow.batch,
        subview: bestRow.subview,
        mean: bestRow.mean,
        hz: bestRow.hz,
        p99: bestRow.p99,
      },
      rows: rowsWithDelta,
    };
  });

  runtimeProfiles[profile.key] = operations.reduce((result, operation) => {
    const operationResult = perOperation[operation];
    result[operation] = {
      batch: operationResult.best.batch,
      subview: operationResult.best.subview,
    };
    return result;
  }, {});

  summaryProfiles[profile.key] = {
    cacheEnabled: profile.cacheEnabled,
    lruMaxEntries: profile.lruMaxEntries,
    operations: perOperation,
  };
});

const generatedAt = new Date().toISOString();
const runtimeMatrix = {
  version: 1,
  generatedAt,
  profiles: runtimeProfiles,
};

const summary = {
  version: 1,
  generatedAt,
  operationBenchmarkNameByOperation,
  profiles: summaryProfiles,
};

fs.writeFileSync(runtimeMatrixPath, JSON.stringify(runtimeMatrix, null, 2));
fs.mkdirSync(path.dirname(benchmarksMatrixPath), { recursive: true });
fs.writeFileSync(benchmarksMatrixPath, JSON.stringify(runtimeMatrix, null, 2));
fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('\nAdaptive matrix summary (lower mean is better):');
profiles.forEach((profile) => {
  console.log(`\n[${profile.key}] cache=${profile.cacheEnabled ? 'on' : 'off'} lru=${profile.lruMaxEntries > 0 ? 'on' : 'off'}`);

  operations.forEach((operation) => {
    const operationResult = summaryProfiles[profile.key].operations[operation];
    console.log(`- ${operation} -> ${operationResult.bestVariantLabel}`);
    operationResult.rows
      .slice()
      .sort((left, right) => left.mean - right.mean)
      .forEach((row) => {
        console.log(
          `  - ${row.label} | mean ${row.mean.toFixed(6)}ms (${formatPercent(row.meanDeltaPercent)}) | p99 ${(row.p99 ?? 0).toFixed(6)}ms | ${(row.hz ?? 0).toFixed(2)}hz`,
        );
      });
  });
});

console.log(`\nWrote runtime matrix to ${runtimeMatrixPath}`);
console.log(`Wrote benchmark matrix to ${benchmarksMatrixPath}`);
console.log(`Wrote summary report to ${summaryPath}`);
