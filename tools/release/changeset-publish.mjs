import { spawn } from 'node:child_process';

import {
  applySanitizedPackageJsons,
  collectPublishablePackages,
  loadWorkspacePackageVersions,
  resolveWorkspaceRoot,
  restorePackageJsons,
} from './publish-manifests.mjs';

const PNPM_BIN = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

const runCommand = ({ args, command, cwd }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
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
  const rootDirectory = resolveWorkspaceRoot();
  const packages = await collectPublishablePackages({ rootDirectory });
  const workspaceVersions = await loadWorkspacePackageVersions({ rootDirectory });
  const backups = await applySanitizedPackageJsons({ packages, workspaceVersions });

  try {
    await runCommand({
      args: ['dlx', '@changesets/cli', 'publish', ...process.argv.slice(2)],
      command: PNPM_BIN,
      cwd: rootDirectory,
    });
  } finally {
    await restorePackageJsons({ backups });
  }
};

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
