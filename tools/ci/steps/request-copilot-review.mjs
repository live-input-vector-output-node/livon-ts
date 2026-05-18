import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';

const parsed = parseArgs({
  options: {
    repo: { type: 'string' },
    pr: { type: 'string' },
  },
});

if (!parsed.values.repo || !parsed.values.pr) {
  throw new Error('--repo and --pr are required');
}

const runRequest = (reviewer) =>
  spawnSync('gh', ['pr', 'edit', parsed.values.pr, '--repo', parsed.values.repo, '--add-reviewer', reviewer], {
    stdio: 'inherit',
  });

const primary = runRequest('@copilot');
if (primary.status === 0) {
  process.exit(0);
}

const fallback = runRequest('copilot');
if (fallback.status === 0) {
  process.exit(0);
}

throw new Error('failed to request Copilot review via gh cli');
