import { parseArgs } from 'node:util';
import { runGitleaks } from '../lib/gitleaks-utils.mjs';

const parsed = parseArgs({
  options: {
    binaryPath: { type: 'string', default: '.ci/bin/gitleaks' },
  },
});

await runGitleaks({ binaryPath: parsed.values.binaryPath });
