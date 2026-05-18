import { parseArgs } from 'node:util';
import process from 'node:process';
import { extractArchive } from '../lib/archive-utils.mjs';

const parsed = parseArgs({
  options: {
    archive: { type: 'string' },
    cwd: { type: 'string', default: process.cwd() },
  },
});

if (!parsed.values.archive) {
  throw new Error('--archive is required');
}

await extractArchive({
  archiveFile: parsed.values.archive,
  cwd: parsed.values.cwd,
});
