import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { parseKeyValueList } from '../lib/cli-utils.mjs';

const parsed = parseArgs({
  options: {
    outputFile: { type: 'string' },
    status: { type: 'string', multiple: true },
    run: { type: 'string', multiple: true },
  },
});

if (!parsed.values.outputFile) {
  throw new Error('--output-file is required');
}

const statuses = parseKeyValueList(parsed.values.status ?? []);
const runs = parseKeyValueList(parsed.values.run ?? []);

const summary = `## Unified Pipeline Summary

| Area | Enabled | Result |
| --- | --- | --- |
| Production dependency install | true | ${statuses.prod ?? 'skipped'} |
| Development dependency install | true | ${statuses.dev ?? 'skipped'} |
| Turbo CI (\`pnpm run ci\`) | ${runs.ci ?? 'false'} | ${statuses.ci ?? 'skipped'} |
| Publish (\`pnpm changeset:publish\`) | ${runs.publish ?? 'false'} | ${statuses.publish ?? 'skipped'} |
| Docs build | ${runs.docs ?? 'false'} | ${statuses.docs_build ?? 'skipped'} |
| Docs deploy | ${runs.docs ?? 'false'} | ${statuses.docs_deploy ?? 'skipped'} |
| Coverage | ${runs.coverage ?? 'false'} | ${statuses.coverage ?? 'skipped'} |
| Secret scan | ${runs.secret_scan ?? 'false'} | ${statuses.secret_scan ?? 'skipped'} |
| Vulnerability scan | ${runs.vuln_scan ?? 'false'} | ${statuses.vuln_scan ?? 'skipped'} |
| Scorecard | ${runs.scorecard ?? 'false'} | ${statuses.scorecard ?? 'skipped'} |

## Pipeline Mindmap

Unified Pipeline
├─ Dependency bootstrap
│  ├─ production install artifact (\`prod-deps\`)
│  └─ development install artifact (\`dev-deps\`)
├─ Quality gates
│  └─ Turbo CI (\`pnpm run ci\`) + \`release:check\`
├─ Build artifact handover
│  └─ \`ci-build-artifacts\`
├─ Release
│  └─ publish job (changeset-trigger semantics)
├─ Documentation
│  ├─ docs build
│  └─ pages deploy
└─ Security & trust
   ├─ gitleaks
   ├─ OSV scan
   └─ OpenSSF scorecard
`;

await writeFile(parsed.values.outputFile, `${summary}\n`, { encoding: 'utf8', flag: 'a' });
