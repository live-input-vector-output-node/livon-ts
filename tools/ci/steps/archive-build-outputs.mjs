import { parseArgs } from 'node:util';
import process from 'node:process';
import { createBuildOutputsArchive } from '../lib/archive-utils.mjs';

const parsed = parseArgs({
  options: {
    archive: { type: 'string' },
    roots: { type: 'string', default: 'packages,apps,tools,website' },
    cwd: { type: 'string', default: process.cwd() },
  },
});

if (!parsed.values.archive) {
  throw new Error('--archive is required');
}

await createBuildOutputsArchive({
  archiveFile: parsed.values.archive,
  cwd: parsed.values.cwd,
  rootsCsv: parsed.values.roots,
});
