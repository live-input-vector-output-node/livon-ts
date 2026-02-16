import { rmSync } from 'node:fs';
import { spawn } from 'node:child_process';

const runRslibBuild = ({ mini }) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'rslib.cmd' : 'rslib', ['build'], {
      stdio: 'inherit',
      env: {
        ...process.env,
        LIVON_BUILD_VARIANT: mini ? 'mini' : 'default',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(undefined);
        return;
      }
      reject(new Error(`rslib build failed with exit code ${code ?? 'unknown'}`));
    });

    child.on('error', reject);
  });

const run = async () => {
  rmSync('dist', { recursive: true, force: true });
  await runRslibBuild({ mini: false });
  await runRslibBuild({ mini: true });
};

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
