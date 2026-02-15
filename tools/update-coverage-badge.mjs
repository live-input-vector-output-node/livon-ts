import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const [summaryArg, outputArg] = process.argv.slice(2);

const summaryPath = resolve(summaryArg ?? 'coverage/coverage-summary.json');
const outputPath = resolve(outputArg ?? '.github/badges/coverage.json');

const summary = JSON.parse(readFileSync(summaryPath, 'utf8'));
const rawPercent = Number(summary?.total?.lines?.pct ?? 0);
const percent = Number.isFinite(rawPercent) ? Math.max(0, Math.min(100, rawPercent)) : 0;
const rounded = Math.round(percent * 10) / 10;

const color =
  rounded >= 90 ? 'brightgreen' :
    rounded >= 80 ? 'green' :
      rounded >= 70 ? 'yellowgreen' :
        rounded >= 60 ? 'yellow' :
          rounded >= 50 ? 'orange' :
            'red';

const badge = {
  schemaVersion: 1,
  label: 'coverage',
  message: `${rounded}%`,
  color,
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(badge, null, 2)}\n`);

// eslint-disable-next-line no-console
console.log(`Updated coverage badge: ${badge.message} (${badge.color}) -> ${outputPath}`);
