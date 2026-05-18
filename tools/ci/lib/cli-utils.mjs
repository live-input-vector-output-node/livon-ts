import { spawn } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import process from 'node:process';

export const runCommand = ({ command, args, env, stdio = 'inherit' }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: env ?? process.env,
      stdio,
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? -1}`));
    });
  });

export const ensureDirectory = async (targetPath) => {
  await mkdir(targetPath, { recursive: true });
};

export const pathExists = async (targetPath) => {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
};

export const parseCsv = (value) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

export const parseKeyValueList = (entries) => {
  const map = {};
  entries.forEach((entry) => {
    const [key, ...rest] = entry.split('=');
    if (!key || rest.length === 0) {
      throw new Error(`Invalid key=value argument: ${entry}`);
    }
    map[key] = rest.join('=');
  });
  return map;
};
