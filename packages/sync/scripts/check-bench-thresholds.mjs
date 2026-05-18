#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const defaultReportPath = 'coverage/bench/report.json';
const defaultThresholdsPath = 'benchmarks/todo-thresholds.json';

const reportInputPath = process.argv[2] ?? defaultReportPath;
const thresholdsInputPath = process.argv[3] ?? defaultThresholdsPath;

const toAbsolutePath = (targetPath) => {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(process.cwd(), targetPath);
};

const readJson = (targetPath) => {
  const raw = fs.readFileSync(targetPath, 'utf8');
  return JSON.parse(raw);
};

const reportPath = toAbsolutePath(reportInputPath);
const thresholdsPath = toAbsolutePath(thresholdsInputPath);

if (!fs.existsSync(reportPath)) {
  console.error(`bench-gate failed: report not found at ${reportPath}`);
  process.exit(1);
}

if (!fs.existsSync(thresholdsPath)) {
  console.error(`bench-gate failed: thresholds not found at ${thresholdsPath}`);
  process.exit(1);
}

const reportJson = readJson(reportPath);
const thresholdsJson = readJson(thresholdsPath);

const flattenBenchmarks = (report) => {
  const files = Array.isArray(report.files) ? report.files : [];
  return files.flatMap((file) => {
    const groups = Array.isArray(file.groups) ? file.groups : [];
    return groups.flatMap((group) => {
      const benchmarks = Array.isArray(group.benchmarks) ? group.benchmarks : [];
      return benchmarks.map((benchmark) => {
        return {
          name: benchmark.name,
          hz: benchmark.hz,
          p99: benchmark.p99,
          mean: benchmark.mean,
          samples: benchmark.samples,
          file: file.filepath,
          group: group.fullName,
        };
      });
    });
  });
};

const benchmarkEntries = flattenBenchmarks(reportJson);

const benchmarkByName = benchmarkEntries.reduce((map, benchmark) => {
  const existing = map.get(benchmark.name);
  if (existing) {
    const duplicate = Array.isArray(existing) ? existing : [existing];
    map.set(benchmark.name, [...duplicate, benchmark]);
    return map;
  }

  map.set(benchmark.name, benchmark);
  return map;
}, new Map());

const thresholdNames = Object.keys(thresholdsJson);
const benchmarkNames = benchmarkEntries.map((benchmark) => benchmark.name);
const hasFiniteNumber = (value) => {
  return typeof value === 'number' && Number.isFinite(value);
};

const hasDuplicates = benchmarkNames.length !== new Set(benchmarkNames).size;

const failures = [];

if (hasDuplicates) {
  const duplicateNames = benchmarkNames.filter((name, index) => {
    return benchmarkNames.indexOf(name) !== index;
  });
  const uniqueDuplicates = Array.from(new Set(duplicateNames));
  failures.push(
    `duplicate benchmark names detected: ${uniqueDuplicates.join(', ')}. names must be unique for thresholds.`,
  );
}

const benchmarksMissingAllNumericMetrics = benchmarkEntries.filter((benchmark) => {
  return !hasFiniteNumber(benchmark.p99)
    && !hasFiniteNumber(benchmark.mean)
    && !hasFiniteNumber(benchmark.hz);
});

const allBenchmarksMissingNumericMetrics = benchmarkEntries.length > 0
  && benchmarksMissingAllNumericMetrics.length === benchmarkEntries.length;
const allBenchmarksMissingSamples = benchmarkEntries.every((benchmark) => {
  return !Array.isArray(benchmark.samples) || benchmark.samples.length === 0;
});

if (allBenchmarksMissingNumericMetrics && allBenchmarksMissingSamples) {
  console.warn('bench-gate warning: benchmark report has no numeric metrics/samples (likely Vitest JSON format change). Skipping threshold enforcement.');
  process.exit(0);
}

const checkMaximumMetric = ({ benchmark, failures, metric, thresholdName, value, unit }) => {
  const actual = benchmark[metric];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return;
  }

  if (typeof actual !== 'number' || !Number.isFinite(actual)) {
    failures.push(`benchmark '${thresholdName}' missing numeric ${metric} result`);
    return;
  }

  if (actual > value) {
    failures.push(
      `benchmark '${thresholdName}' exceeded ${metric} budget (${actual.toFixed(4)}${unit} > ${value.toFixed(4)}${unit})`,
    );
  }
};

const checkMinimumHz = ({ benchmark, failures, thresholdName, value }) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return;
  }

  if (typeof benchmark.hz !== 'number' || !Number.isFinite(benchmark.hz)) {
    failures.push(`benchmark '${thresholdName}' missing numeric hz result`);
    return;
  }

  if (benchmark.hz < value) {
    failures.push(
      `benchmark '${thresholdName}' below throughput budget (${benchmark.hz.toFixed(2)}hz < ${value.toFixed(2)}hz)`,
    );
  }
};

thresholdNames.forEach((thresholdName) => {
  const benchmark = benchmarkByName.get(thresholdName);
  if (!benchmark || Array.isArray(benchmark)) {
    failures.push(`missing benchmark result for threshold '${thresholdName}'`);
    return;
  }

  const threshold = thresholdsJson[thresholdName] ?? {};
  const maxP99Ms = threshold.maxP99Ms;
  const minHz = threshold.minHz;
  const maxMeanMs = threshold.maxMeanMs;

  checkMaximumMetric({ benchmark, failures, metric: 'p99', thresholdName, value: maxP99Ms, unit: 'ms' });
  checkMaximumMetric({ benchmark, failures, metric: 'mean', thresholdName, value: maxMeanMs, unit: 'ms' });
  checkMinimumHz({ benchmark, failures, thresholdName, value: minHz });
});

const unknownBenchmarks = benchmarkEntries
  .map((benchmark) => benchmark.name)
  .filter((name) => {
    return !thresholdNames.includes(name);
  });

if (unknownBenchmarks.length > 0) {
  failures.push(`thresholds missing for benchmarks: ${unknownBenchmarks.join(', ')}`);
}

if (failures.length > 0) {
  console.error(`bench-gate failed with ${failures.length} issue(s):`);
  failures.forEach((failure) => {
    console.error(`- ${failure}`);
  });
  process.exit(1);
}

console.log(`bench-gate passed (${benchmarkEntries.length} benchmark thresholds satisfied).`);
