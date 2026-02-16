import { spawn } from 'node:child_process';
import path from 'node:path';

const ROOT_DIRECTORY = process.cwd();
const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const NODE_BIN = process.platform === 'win32' ? 'node.exe' : 'node';
const SYNC_SCRIPT_PATH = path.join('tools', 'release', 'sync-root-version.mjs');

const runCommand = ({ command, args }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: ROOT_DIRECTORY,
      stdio: 'inherit',
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command failed: ${command} ${args.join(' ')} (exit ${code ?? 'unknown'})`));
    });

    child.on('error', (error) => {
      reject(error);
    });
  });

const run = async () => {
  await runCommand({
    command: PNPM_BIN,
    args: ['dlx', '@changesets/cli', 'version'],
  });

  await runCommand({
    command: NODE_BIN,
    args: [SYNC_SCRIPT_PATH],
  });
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
