import { parseArgs } from 'node:util';
import { readFile, writeFile } from 'node:fs/promises';

const parsed = parseArgs({
  options: {
    repo: { type: 'string' },
    pr: { type: 'string' },
    projectKey: { type: 'string' },
    outputFile: { type: 'string' },
  },
});

if (!parsed.values.repo || !parsed.values.pr || !parsed.values.outputFile) {
  throw new Error('--repo, --pr and --outputFile are required');
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

const authHeader = `Basic ${Buffer.from(`${sonarToken}:`, 'utf8').toString('base64')}`;

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
    ps: '20',
  }),
  fetchSonarJson('/api/hotspots/search', {
    projectKey,
    pullRequest: parsed.values.pr,
    ps: '20',
  }),
]);

const measuresByKey = new Map((measures.component?.measures ?? []).map((item) => [item.metric, item.value]));
const qualityGate = projectStatus.projectStatus ?? { status: 'UNKNOWN', conditions: [] };
const issueComponents = new Map((issues.components ?? []).map((item) => [item.key, item.path ?? item.longName ?? item.name]));
const hotspotComponents = new Map((hotspots.components ?? []).map((item) => [item.key, item.path ?? item.longName ?? item.name]));

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
  `### Open Sonar Issues (${issues.total ?? 0})`,
  '',
  '| Type | Severity | File | Line | Message |',
  '| --- | --- | --- | --- | --- |',
  ...(issues.issues?.length
    ? issues.issues.map((item) => {
        const path = issueComponents.get(item.component) ?? item.component ?? '-';
        const startLine = item.textRange?.startLine ?? item.line ?? '-';
        const endLine = item.textRange?.endLine ?? startLine;
        const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
        return `| ${item.type ?? '-'} | ${item.severity ?? '-'} | \`${path}\` | ${lineRange} | ${escapeMd(item.message ?? '-')} |`;
      })
    : ['| - | - | - | - | Keine offenen Sonar Issues auf diesem PR |']),
  '',
  `### Open Security Hotspots (${hotspots.paging?.total ?? 0})`,
  '',
  '| Risk | File | Line | Status | Message |',
  '| --- | --- | --- | --- | --- |',
  ...(hotspots.hotspots?.length
    ? hotspots.hotspots.map((item) => {
        const path = hotspotComponents.get(item.component) ?? item.component ?? '-';
        const startLine = item.textRange?.startLine ?? item.line ?? '-';
        const endLine = item.textRange?.endLine ?? startLine;
        const lineRange = startLine === endLine ? `${startLine}` : `${startLine}-${endLine}`;
        return `| ${item.vulnerabilityProbability ?? '-'} | \`${path}\` | ${lineRange} | ${item.status ?? '-'} | ${escapeMd(item.message ?? '-')} |`;
      })
    : ['| - | - | - | - | Keine offenen Security Hotspots auf diesem PR |']),
  '',
].join('\n');

await writeFile(parsed.values.outputFile, `${summarySection}\n`, { encoding: 'utf8', flag: 'a' });

if (process.env.GITHUB_TOKEN) {
  await upsertPrComment({
    repo: parsed.values.repo,
    pr: parsed.values.pr,
    body: [
      '<!-- sonar-pr-summary -->',
      '## SonarCloud PR Summary',
      '',
      `Quality Gate: **${qualityGate.status ?? 'UNKNOWN'}**`,
      '',
      `Dashboard: ${sonarDashboardUrl}`,
      '',
      '| Metric | Value |',
      '| --- | --- |',
      `| New Coverage | ${formatMetric(measuresByKey.get('new_coverage'), '%')} |`,
      `| New Duplication | ${formatMetric(measuresByKey.get('new_duplicated_lines_density'), '%')} |`,
      `| New Vulnerabilities | ${formatMetric(measuresByKey.get('new_vulnerabilities'))} |`,
      `| New Security Hotspots Reviewed | ${formatMetric(measuresByKey.get('new_security_hotspots_reviewed'), '%')} |`,
      '',
      `_Top issues/hotspots mit Datei + Zeilenbereich stehen in der Action Summary._`,
    ].join('\n'),
  });
}

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
  return String(value).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function formatMetric(value, suffix = '') {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  return `${value}${suffix}`;
}

async function upsertPrComment({ repo, pr, body }) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`invalid --repo value: ${repo}`);
  }
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const listResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${encodeURIComponent(pr)}/comments?per_page=100`,
    { headers },
  );
  if (!listResponse.ok) {
    const text = await listResponse.text();
    throw new Error(`github comments list failed (${listResponse.status}): ${text}`);
  }

  const comments = await listResponse.json();
  const existing = comments.find(
    (comment) => typeof comment?.body === 'string' && comment.body.includes('<!-- sonar-pr-summary -->'),
  );

  if (existing) {
    const updateResponse = await fetch(
      `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/comments/${existing.id}`,
      {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ body }),
      },
    );
    if (!updateResponse.ok) {
      const text = await updateResponse.text();
      throw new Error(`github comment update failed (${updateResponse.status}): ${text}`);
    }
    return;
  }

  const createResponse = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${encodeURIComponent(pr)}/comments`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ body }),
    },
  );
  if (!createResponse.ok) {
    const text = await createResponse.text();
    throw new Error(`github comment create failed (${createResponse.status}): ${text}`);
  }
}
