import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { parseKeyValueList } from '../lib/cli-utils.mjs';

const parsed = parseArgs({
  options: {
    outputFile: { type: 'string' },
    failOnEnabledFailure: { type: 'boolean', default: false },
    status: { type: 'string', multiple: true },
    run: { type: 'string', multiple: true },
  },
});

if (!parsed.values.outputFile) {
  throw new Error('--outputFile is required');
}

const statuses = parseKeyValueList(parsed.values.status ?? []);
const runs = parseKeyValueList(parsed.values.run ?? []);

const isEnabled = (value) => value === 'true';
const assertEnabledJob = ({ enabled, name, statusValue }) => {
  if (!enabled) {
    return;
  }
  if (statusValue === 'success') {
    return;
  }
  throw new Error(`enabled pipeline branch "${name}" is not successful (status=${statusValue ?? 'unknown'})`);
};

const summary = `## Unified Pipeline Summary

| Area | Enabled | Result |
| --- | --- | --- |
| Shared dependency caches | ${runs.dev_dependencies ?? 'false'} | ${statuses.dev_dependencies ?? 'skipped'} |
| Development dependency install | ${runs.dev_dependencies ?? 'false'} | ${statuses.dev_dependencies ?? 'skipped'} |
| Turbo CI (\`pnpm run ci\`) | ${runs.ci ?? 'false'} | ${statuses.ci ?? 'skipped'} |
| SonarQube Cloud | ${runs.sonarcloud ?? 'false'} | ${statuses.sonarcloud ?? 'skipped'} |
| Publish (\`pnpm changeset:publish\`) | ${runs.publish ?? 'false'} | ${statuses.publish ?? 'skipped'} |
| Docs build | ${runs.docs ?? 'false'} | ${statuses.docs_build ?? 'skipped'} |
| Docs deploy | ${runs.docs ?? 'false'} | ${statuses.docs_deploy ?? 'skipped'} |
| Coverage | ${runs.coverage ?? 'false'} | ${statuses.coverage ?? 'skipped'} |
| Secret scan | ${runs.secret_scan ?? 'false'} | ${statuses.secret_scan ?? 'skipped'} |
| Vulnerability scan | ${runs.vuln_scan ?? 'false'} | ${statuses.vuln_scan ?? 'skipped'} |
| Scorecard | ${runs.scorecard ?? 'false'} | ${statuses.scorecard ?? 'skipped'} |

## Pipeline Mindmap

\`\`\`text
Unified Pipeline
├─ Dependency bootstrap
│  ├─ shared pnpm store cache
│  └─ shared turborepo cache
├─ Quality gates
│  └─ Turbo CI (\`pnpm run ci\`) + \`release:check\`
├─ Static code analysis
│  └─ SonarQube Cloud (quality gate wait)
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
\`\`\`
`;

await writeFile(parsed.values.outputFile, `${summary}\n`, { encoding: 'utf8', flag: 'a' });

if (parsed.values.failOnEnabledFailure) {
  assertEnabledJob({
    enabled: isEnabled(runs.copilot_review),
    name: 'copilot_review',
    statusValue: statuses.copilot_review,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.dev_dependencies),
    name: 'dev_dependencies',
    statusValue: statuses.dev_dependencies,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.ci),
    name: 'ci',
    statusValue: statuses.ci,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.sonarcloud),
    name: 'sonarcloud',
    statusValue: statuses.sonarcloud,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.publish),
    name: 'publish',
    statusValue: statuses.publish,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.docs),
    name: 'docs_build',
    statusValue: statuses.docs_build,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.docs),
    name: 'docs_deploy',
    statusValue: statuses.docs_deploy,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.coverage),
    name: 'coverage',
    statusValue: statuses.coverage,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.secret_scan),
    name: 'secret_scan',
    statusValue: statuses.secret_scan,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.vuln_scan),
    name: 'vulnerability_scan',
    statusValue: statuses.vuln_scan,
  });
  assertEnabledJob({
    enabled: isEnabled(runs.scorecard),
    name: 'scorecard',
    statusValue: statuses.scorecard,
  });
}
