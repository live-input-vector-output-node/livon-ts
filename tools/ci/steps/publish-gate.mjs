import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const parsed = parseArgs({
  options: {
    before: { type: 'string' },
    head: { type: 'string' },
    outputFile: { type: 'string' },
  },
});

if (!parsed.values.before || !parsed.values.head) {
  throw new Error('--before and --head are required');
}
if (!parsed.values.outputFile) {
  throw new Error('--output-file is required');
}

let runPublish = false;

if (parsed.values.before !== '0000000000000000000000000000000000000000') {
  const child = spawn('git', ['diff', '--name-only', parsed.values.before, parsed.values.head, '--', '.changeset'], {
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  let stdout = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', resolve);
  });

  if (exitCode !== 0) {
    throw new Error('git diff failed while evaluating publish gate');
  }

  runPublish = stdout
    .split('\n')
    .map((line) => line.trim())
    .some((line) => line.startsWith('.changeset/') && line.endsWith('.md') && line !== '.changeset/README.md');
}

await writeFile(parsed.values.outputFile, `run_publish=${runPublish ? 'true' : 'false'}\n`, {
  encoding: 'utf8',
  flag: 'a',
});
