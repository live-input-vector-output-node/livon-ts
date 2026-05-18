import { parseArgs } from 'node:util';
import process from 'node:process';
import { createArchive } from '../lib/archive-utils.mjs';

const parsed = parseArgs({
  options: {
    archive: { type: 'string' },
    paths: { type: 'string', default: 'node_modules,.pnpm-store,.turbo' },
    cwd: { type: 'string', default: process.cwd() },
  },
});

if (!parsed.values.archive) {
  throw new Error('--archive is required');
}

await createArchive({
  archiveFile: parsed.values.archive,
  cwd: parsed.values.cwd,
  pathsCsv: parsed.values.paths,
});
