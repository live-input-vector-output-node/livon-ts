#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const coverageDirectoryPath = path.resolve('coverage/bench');
const summaryPath = path.join(coverageDirectoryPath, 'source-api-summary.json');
const BENCH_TODO_COUNT = 10_000;
const DEFAULT_NEUTRAL_AB_ROUNDS = 2;

const sourceApiModes = [
  'direct',
  'lazy',
];

const resolveIntegerEnv = ({
  name,
  fallback,
}) => {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallback;
  }

  return parsedValue;
};

const toRoundLabel = (round) => {
  return String(round).padStart(2, '0');
};

const createRoundOrder = (roundIndex) => {
  if (roundIndex % 2 === 0) {
    return ['direct', 'lazy'];
  }

  return ['lazy', 'direct'];
};

const neutralAbRounds = resolveIntegerEnv({
  name: 'LIVON_SYNC_BENCH_SOURCE_API_NEUTRAL_AB_ROUNDS',
  fallback: DEFAULT_NEUTRAL_AB_ROUNDS,
});

const executionPlan = Array.from({ length: neutralAbRounds }, (_unused, roundIndex) => {
  return {
    round: roundIndex + 1,
    order: createRoundOrder(roundIndex),
  };
});

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
        LIVON_SYNC_BENCH_SOURCE_API: mode,
        LIVON_SYNC_BENCH_SOURCE_API_MATRIX: 'false',
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

const average = (values) => {
  if (values.length === 0) {
    return 0;
  }

  const total = values.reduce((sum, value) => {
    return sum + value;
  }, 0);

  return total / values.length;
};

const median = (values) => {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const middleIndex = Math.floor(sorted.length / 2);
  const middleValue = sorted[middleIndex];
  if (typeof middleValue !== 'number') {
    return 0;
  }

  if (sorted.length % 2 !== 0) {
    return middleValue;
  }

  const leftValue = sorted[middleIndex - 1];
  if (typeof leftValue !== 'number') {
    return middleValue;
  }

  return (leftValue + middleValue) / 2;
};

const flattenReportBenchmarkNames = (runs) => {
  return Array.from(new Set(runs.flatMap((run) => {
    return run.benchmarks.map((benchmark) => benchmark.name);
  }))).sort((left, right) => left.localeCompare(right));
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
    return entry.name === name || entry.benchmarkName === name;
  });
};

const aggregateModeRuns = ({
  mode,
  runs,
}) => {
  const benchmarkNames = flattenReportBenchmarkNames(runs);

  return benchmarkNames.map((benchmarkName) => {
    const benchmarkSeries = runs.map((run) => {
      const benchmark = getByBenchmarkName(run.benchmarks, benchmarkName);
      if (!benchmark) {
        throw new Error(`Missing benchmark '${benchmarkName}' for mode '${mode}' in round ${run.round}`);
      }

      return benchmark;
    });

    const means = benchmarkSeries.map((benchmark) => benchmark.mean);
    const p99Values = benchmarkSeries.map((benchmark) => benchmark.p99);
    const hzValues = benchmarkSeries.map((benchmark) => benchmark.hz ?? 0);

    return {
      benchmarkName,
      meanMedian: median(means),
      meanAverage: average(means),
      meanMin: Math.min(...means),
      meanMax: Math.max(...means),
      p99Median: median(p99Values),
      hzAverage: average(hzValues),
      samples: benchmarkSeries.length,
    };
  });
};

const modeRunRecords = [];

fs.mkdirSync(coverageDirectoryPath, { recursive: true });

executionPlan.forEach(({ round, order }) => {
  order.forEach((mode, orderIndex) => {
    const reportPath = path.join(
      coverageDirectoryPath,
      `report.source-api.${mode}.round-${toRoundLabel(round)}.json`,
    );
    runBenchMode({
      mode,
      reportPath,
    });
    const report = readJson(reportPath);
    modeRunRecords.push({
      mode,
      round,
      orderIndex,
      reportPath,
      benchmarks: flattenBenchmarks(report),
    });
  });
});

const runsByMode = new Map(sourceApiModes.map((mode) => {
  return [
    mode,
    modeRunRecords.filter((runRecord) => {
      return runRecord.mode === mode;
    }),
  ];
}));

const directRuns = runsByMode.get('direct') ?? [];
const lazyRuns = runsByMode.get('lazy') ?? [];

sourceApiModes.forEach((mode) => {
  const modeRuns = runsByMode.get(mode) ?? [];
  const latestRun = modeRuns
    .slice()
    .sort((left, right) => {
      if (left.round !== right.round) {
        return left.round - right.round;
      }

      return left.orderIndex - right.orderIndex;
    })
    .at(-1);

  if (!latestRun) {
    throw new Error(`No run found for mode '${mode}'.`);
  }

  const legacyReportPath = path.join(coverageDirectoryPath, `report.source-api.${mode}.json`);
  fs.copyFileSync(latestRun.reportPath, legacyReportPath);
});

const directBenchmarks = aggregateModeRuns({
  mode: 'direct',
  runs: directRuns,
});
const lazyBenchmarks = aggregateModeRuns({
  mode: 'lazy',
  runs: lazyRuns,
});

const benchmarkNames = Array.from(
  new Set([
    ...directBenchmarks.map((benchmark) => benchmark.benchmarkName),
    ...lazyBenchmarks.map((benchmark) => benchmark.benchmarkName),
  ]),
).sort((left, right) => left.localeCompare(right));

const comparisonRows = benchmarkNames.map((benchmarkName) => {
  const directBenchmark = getByBenchmarkName(directBenchmarks, benchmarkName);
  const lazyBenchmark = getByBenchmarkName(lazyBenchmarks, benchmarkName);
  if (!directBenchmark || !lazyBenchmark) {
    throw new Error(`Missing benchmark '${benchmarkName}' in one source-api mode report.`);
  }

  const meanDeltaPercent = directBenchmark.meanMedian === 0
    ? 0
    : ((lazyBenchmark.meanMedian - directBenchmark.meanMedian) / directBenchmark.meanMedian) * 100;

  return {
    benchmarkName,
    meanDeltaPercent,
    fasterMode: lazyBenchmark.meanMedian < directBenchmark.meanMedian ? 'lazy' : 'direct',
    direct: {
      meanMedian: directBenchmark.meanMedian,
      meanAverage: directBenchmark.meanAverage,
      meanMin: directBenchmark.meanMin,
      meanMax: directBenchmark.meanMax,
      hzAverage: directBenchmark.hzAverage,
      p99Median: directBenchmark.p99Median,
      samples: directBenchmark.samples,
    },
    lazy: {
      meanMedian: lazyBenchmark.meanMedian,
      meanAverage: lazyBenchmark.meanAverage,
      meanMin: lazyBenchmark.meanMin,
      meanMax: lazyBenchmark.meanMax,
      hzAverage: lazyBenchmark.hzAverage,
      p99Median: lazyBenchmark.p99Median,
      samples: lazyBenchmark.samples,
    },
  };
});

const wins = comparisonRows.reduce((result, row) => {
  result[row.fasterMode] = (result[row.fasterMode] ?? 0) + 1;
  return result;
}, {
  direct: 0,
  lazy: 0,
});

const meanDeltaAveragePercent = comparisonRows.length === 0
  ? 0
  : comparisonRows.reduce((sum, row) => {
    return sum + row.meanDeltaPercent;
  }, 0) / comparisonRows.length;

const summary = {
  generatedAt: new Date().toISOString(),
  method: 'neutral-ab',
  neutralAbRounds,
  executionPlan,
  todoCount: BENCH_TODO_COUNT,
  reports: modeRunRecords.map((record) => {
    return {
      mode: record.mode,
      round: record.round,
      orderIndex: record.orderIndex,
      reportPath: record.reportPath,
    };
  }),
  wins,
  meanDeltaAveragePercent,
  rows: comparisonRows,
};

fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

console.log('\nSource API neutral A/B run plan:');
executionPlan.forEach((planEntry) => {
  console.log(`- round ${planEntry.round}: ${planEntry.order.join(' -> ')}`);
});

console.log(`\nSource API comparison (lazy vs direct, todoCount=${BENCH_TODO_COUNT}, metric=median(mean)):`);
comparisonRows.forEach((row) => {
  console.log(`\n${row.benchmarkName}`);
  console.log(`- direct | median mean ${formatMs(row.direct.meanMedian)} | avg mean ${formatMs(row.direct.meanAverage)} | range ${formatMs(row.direct.meanMin)}..${formatMs(row.direct.meanMax)} | p99 median ${formatMs(row.direct.p99Median)} | avg ${(row.direct.hzAverage ?? 0).toFixed(2)}hz | runs ${row.direct.samples}`);
  console.log(`- lazy   | median mean ${formatMs(row.lazy.meanMedian)} | avg mean ${formatMs(row.lazy.meanAverage)} | range ${formatMs(row.lazy.meanMin)}..${formatMs(row.lazy.meanMax)} | p99 median ${formatMs(row.lazy.p99Median)} | avg ${(row.lazy.hzAverage ?? 0).toFixed(2)}hz | runs ${row.lazy.samples}`);
  console.log(`- delta (lazy vs direct): ${formatPercent(row.meanDeltaPercent)} | faster: ${row.fasterMode}`);
});

console.log('\nMode wins:');
console.log(`- direct: ${wins.direct}`);
console.log(`- lazy: ${wins.lazy}`);
console.log(`- average mean delta (lazy vs direct): ${formatPercent(meanDeltaAveragePercent)}`);
console.log(`\nWrote source-api summary to ${summaryPath}`);
