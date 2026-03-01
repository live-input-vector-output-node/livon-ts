import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const resolveWorkspaceRoot = (startDir = process.cwd()) => {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return path.resolve(startDir);
};

const ROOT_DIRECTORY = resolveWorkspaceRoot();
const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const NODE_BIN = process.platform === 'win32' ? 'node.exe' : 'node';
const SYNC_SCRIPT_PATH = path.join(ROOT_DIRECTORY, 'tools', 'release', 'sync-root-version.mjs');

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
