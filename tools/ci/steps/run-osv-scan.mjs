import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { installOsvScanner, runOsvScanner } from '../lib/osv-utils.mjs';
import { pathExists } from '../lib/cli-utils.mjs';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(currentDir, '../../..');
const defaultBinaryName = process.platform === 'win32' ? 'osv-scanner.exe' : 'osv-scanner';
const binaryPath = path.resolve(repositoryRoot, '.ci/bin', defaultBinaryName);

if (!(await pathExists(binaryPath))) {
  await installOsvScanner({
    version: '2.3.8',
    outputPath: binaryPath,
  });
}

await runOsvScanner({ binaryPath });
