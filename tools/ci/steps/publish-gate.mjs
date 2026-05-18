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
  throw new Error('--outputFile is required');
}

const runGitDiff = ({ from, to }) =>
  new Promise((resolve, reject) => {
    const child = spawn('git', ['diff', '--name-only', from, to, '--', '.changeset'], {
      stdio: ['ignore', 'pipe', 'inherit'],
    });

    let stdout = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (exitCode) => {
      if (exitCode !== 0) {
        reject(new Error(`git diff failed for range ${from}..${to}`));
        return;
      }
      resolve(stdout);
    });
  });

let runPublish = false;
const zeroSha = '0000000000000000000000000000000000000000';

const diffOutput = await (async () => {
  if (parsed.values.before !== zeroSha) {
    return runGitDiff({
      from: parsed.values.before,
      to: parsed.values.head,
    });
  }

  console.warn(
    'publish-gate: github.event.before is zero-SHA; falling back to head~1 comparison for first/rewritten push history.',
  );

  try {
    return await runGitDiff({
      from: `${parsed.values.head}~1`,
      to: parsed.values.head,
    });
  } catch (error) {
    console.warn(`publish-gate: fallback diff failed, skipping publish for safety (${String(error)})`);
    return '';
  }
})();

runPublish = diffOutput
  .split('\n')
  .map((line) => line.trim())
  .some((line) => line.startsWith('.changeset/') && line.endsWith('.md') && line !== '.changeset/README.md');

await writeFile(parsed.values.outputFile, `run_publish=${runPublish ? 'true' : 'false'}\n`, {
  encoding: 'utf8',
  flag: 'a',
});
