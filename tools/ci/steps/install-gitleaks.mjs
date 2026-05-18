import { parseArgs } from 'node:util';
import { installGitleaks } from '../lib/gitleaks-utils.mjs';

const parsed = parseArgs({
  options: {
    version: { type: 'string', default: '8.30.1' },
    outputPath: { type: 'string', default: '.ci/bin/gitleaks' },
  },
});

await installGitleaks({
  version: parsed.values.version,
  outputPath: parsed.values.outputPath,
});
