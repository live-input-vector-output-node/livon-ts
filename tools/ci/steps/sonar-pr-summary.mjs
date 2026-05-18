import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const parsed = parseArgs({
  options: {
    pr: { type: 'string' },
    projectKey: { type: 'string' },
    outputFile: { type: 'string' },
  },
});

if (!parsed.values.pr || !parsed.values.outputFile) {
  throw new Error('--pr and --outputFile are required');
}

const projectKey = parsed.values.projectKey ?? (await resolveProjectKeyFromProperties());
if (!projectKey) {
  throw new Error('unable to resolve sonar project key (pass --projectKey or set sonar.projectKey)');
}

const sonarToken = process.env.SONAR_TOKEN;
if (!sonarToken) {
  throw new Error('SONAR_TOKEN is required');
}

const sonarBase = 'https://sonarcloud.io';
const sonarDashboardUrl = `${sonarBase}/dashboard?id=${encodeURIComponent(projectKey)}&pullRequest=${encodeURIComponent(parsed.values.pr)}`;
const sonarCredential = `${sonarToken}:`;
const authHeader = `Basic ${Buffer.from(sonarCredential, 'utf8').toString('base64')}`;

const [projectStatus, measures, issues, hotspots] = await Promise.all([
  fetchSonarJson('/api/qualitygates/project_status', {
    projectKey,
    pullRequest: parsed.values.pr,
  }),
  fetchSonarJson('/api/measures/component', {
    component: projectKey,
    pullRequest: parsed.values.pr,
    metricKeys: [
      'new_coverage',
      'coverage',
      'new_duplicated_lines_density',
      'duplicated_lines_density',
      'new_bugs',
      'new_vulnerabilities',
      'new_code_smells',
      'new_security_hotspots',
      'new_security_hotspots_reviewed',
      'new_reliability_rating',
      'new_security_rating',
      'new_maintainability_rating',
    ].join(','),
  }),
  fetchSonarJson('/api/issues/search', {
    componentKeys: projectKey,
    pullRequest: parsed.values.pr,
    types: 'BUG,VULNERABILITY,CODE_SMELL',
    statuses: 'OPEN,REOPENED,CONFIRMED',
    s: 'SEVERITY',
    ps: '100',
  }),
  fetchSonarJson('/api/hotspots/search', {
    projectKey,
    pullRequest: parsed.values.pr,
    ps: '100',
  }),
]);

const measuresByKey = new Map((measures.component?.measures ?? []).map((item) => [item.metric, item.value]));
const qualityGate = projectStatus.projectStatus ?? { status: 'UNKNOWN', conditions: [] };
const issueComponents = new Map((issues.components ?? []).map((item) => [item.key, item.path ?? item.longName ?? item.name]));
const hotspotComponents = new Map((hotspots.components ?? []).map((item) => [item.key, item.path ?? item.longName ?? item.name]));

const findings = [
  ...(issues.issues ?? []).map((item) => ({
    findingKey: `issue:${item.key}`,
    kind: item.type ?? 'ISSUE',
    severity: item.severity ?? '-',
    message: item.message ?? '-',
    path: issueComponents.get(item.component) ?? item.component ?? '-',
    startLine: item.textRange?.startLine ?? item.line ?? null,
    endLine: item.textRange?.endLine ?? item.textRange?.startLine ?? item.line ?? null,
    sonarUrl: `${sonarBase}/project/issues?id=${encodeURIComponent(projectKey)}&pullRequest=${encodeURIComponent(parsed.values.pr)}&open=${encodeURIComponent(item.key)}`,
  })),
  ...(hotspots.hotspots ?? []).map((item) => ({
    findingKey: `hotspot:${item.key}`,
    kind: 'SECURITY_HOTSPOT',
    severity: item.vulnerabilityProbability ?? '-',
    message: item.message ?? '-',
    path: hotspotComponents.get(item.component) ?? item.component ?? '-',
    startLine: item.textRange?.startLine ?? item.line ?? null,
    endLine: item.textRange?.endLine ?? item.textRange?.startLine ?? item.line ?? null,
    sonarUrl: `${sonarBase}/security_hotspots?id=${encodeURIComponent(projectKey)}&pullRequest=${encodeURIComponent(parsed.values.pr)}&hotspots=${encodeURIComponent(item.key)}`,
  })),
];

const summarySection = [
  '## SonarCloud PR Summary',
  '',
  `- Dashboard: ${sonarDashboardUrl}`,
  `- Quality Gate: **${qualityGate.status ?? 'UNKNOWN'}**`,
  '',
  '| Metric | Value |',
  '| --- | --- |',
  `| New Coverage | ${formatMetric(measuresByKey.get('new_coverage'), '%')} |`,
  `| Coverage | ${formatMetric(measuresByKey.get('coverage'), '%')} |`,
  `| New Duplication | ${formatMetric(measuresByKey.get('new_duplicated_lines_density'), '%')} |`,
  `| Duplication | ${formatMetric(measuresByKey.get('duplicated_lines_density'), '%')} |`,
  `| New Bugs | ${formatMetric(measuresByKey.get('new_bugs'))} |`,
  `| New Vulnerabilities | ${formatMetric(measuresByKey.get('new_vulnerabilities'))} |`,
  `| New Code Smells | ${formatMetric(measuresByKey.get('new_code_smells'))} |`,
  `| New Security Hotspots | ${formatMetric(measuresByKey.get('new_security_hotspots'))} |`,
  `| New Security Hotspots Reviewed | ${formatMetric(measuresByKey.get('new_security_hotspots_reviewed'), '%')} |`,
  '',
  '### Quality Gate Conditions',
  '',
  '| Metric | Status | Actual | Threshold |',
  '| --- | --- | --- | --- |',
  ...((qualityGate.conditions ?? []).map(
    (condition) =>
      `| ${condition.metricKey ?? '-'} | ${condition.status ?? '-'} | ${condition.actualValue ?? '-'} | ${condition.errorThreshold ?? '-'} |`,
  )),
  '',
  `### Open Sonar Findings (${findings.length})`,
  '',
  '| Type | Severity | File | Line | Message |',
  '| --- | --- | --- | --- | --- |',
  ...(findings.length
    ? findings.slice(0, 100).map((item) => {
        const lineRange = renderLineRange(item.startLine, item.endLine);
        return `| ${item.kind} | ${item.severity} | \`${item.path}\` | ${lineRange} | ${escapeMd(item.message)} |`;
      })
    : ['| - | - | - | - | Keine offenen Sonar Findings auf diesem PR |']),
  '',
].join('\n');

await writeFile(parsed.values.outputFile, `${summarySection}\n`, { encoding: 'utf8', flag: 'a' });

async function resolveProjectKeyFromProperties() {
  try {
    const content = await readFile('sonar-project.properties', 'utf8');
    const line = content
      .split('\n')
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith('sonar.projectKey='));
    return line ? line.slice('sonar.projectKey='.length).trim() : '';
  } catch {
    return '';
  }
}

async function fetchSonarJson(pathname, params) {
  const url = new URL(`${sonarBase}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, value);
    }
  }
  const response = await fetch(url, {
    headers: {
      Authorization: authHeader,
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`sonar api request failed (${response.status}) for ${url.pathname}: ${text}`);
  }
  return response.json();
}

function escapeMd(value) {
  return String(value).replaceAll('|', String.raw`\|`).replaceAll('\n', ' ');
}

function formatMetric(value, suffix = '') {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return `${value}${suffix}`;
}

function renderLineRange(startLine, endLine) {
  if (!Number.isInteger(startLine)) {
    return '-';
  }
  if (!Number.isInteger(endLine) || endLine === startLine) {
    return `${startLine}`;
  }
  return `${startLine}-${endLine}`;
}
