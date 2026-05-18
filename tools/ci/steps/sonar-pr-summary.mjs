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

if (process.env.GITHUB_TOKEN) {
  const inlineResult = await publishInlineReviewComments({
    repo: parsed.values.repo,
    pr: parsed.values.pr,
    findings,
  });

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
      `Inline review comments erstellt: **${inlineResult.created}**`,
      `Nicht platzierbar im PR-Diff (Fallback in Summary): **${inlineResult.unplaced.length}**`,
      '',
      ...(inlineResult.unplaced.length
        ? [
            '### Unplaced Findings',
            '',
            ...inlineResult.unplaced.slice(0, 30).map((item) => {
              const lineRange = renderLineRange(item.startLine, item.endLine);
              return `- ${item.kind} ${item.severity} in \`${item.path}:${lineRange}\` - ${item.message}`;
            }),
          ]
        : []),
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

function renderLineRange(startLine, endLine) {
  if (!Number.isInteger(startLine)) {
    return '-';
  }
  if (!Number.isInteger(endLine) || endLine === startLine) {
    return `${startLine}`;
  }
  return `${startLine}-${endLine}`;
}

async function githubApi(path, { method = 'GET', body } = {}) {
  const headers = {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`github api ${method} ${path} failed (${response.status}): ${text}`);
  }

  if (response.status === 204) {
    return null;
  }
  return response.json();
}

async function upsertPrComment({ repo, pr, body }) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`invalid --repo value: ${repo}`);
  }

  const comments = await githubApi(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${encodeURIComponent(pr)}/comments?per_page=100`,
  );

  const existing = comments.find(
    (comment) => typeof comment?.body === 'string' && comment.body.includes('<!-- sonar-pr-summary -->'),
  );

  if (existing) {
    await githubApi(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/comments/${existing.id}`,
      {
        method: 'PATCH',
        body: { body },
      },
    );
    return;
  }

  await githubApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${encodeURIComponent(pr)}/comments`, {
    method: 'POST',
    body: { body },
  });
}

async function publishInlineReviewComments({ repo, pr, findings }) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) {
    throw new Error(`invalid --repo value: ${repo}`);
  }

  const prData = await githubApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${encodeURIComponent(pr)}`);
  const headSha = prData?.head?.sha;
  if (!headSha) {
    return { created: 0, unplaced: findings };
  }

  const files = await listPrFiles({ owner, name, pr });
  const fileMap = new Map(files.map((file) => [file.filename, parseAddedLines(file.patch ?? '')]));

  const existingComments = await listReviewComments({ owner, name, pr });
  const markerPrefix = '<!-- sonar-inline:';
  for (const comment of existingComments) {
    if (comment?.user?.login === 'github-actions[bot]' && typeof comment.body === 'string' && comment.body.includes(markerPrefix)) {
      await githubApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/comments/${comment.id}`, {
        method: 'DELETE',
      });
    }
  }

  let created = 0;
  const unplaced = [];

  for (const item of findings) {
    const diffLines = fileMap.get(item.path);
    if (!diffLines || diffLines.size === 0) {
      unplaced.push(item);
      continue;
    }

    const placement = resolvePlacement({
      startLine: item.startLine,
      endLine: item.endLine,
      diffLines,
    });

    if (!placement) {
      unplaced.push(item);
      continue;
    }

    const marker = `<!-- sonar-inline:${item.findingKey}:${headSha} -->`;
    const body = [
      marker,
      `Sonar ${item.kind} (${item.severity})`,
      '',
      item.message,
      '',
      `Source: ${item.sonarUrl}`,
    ].join('\n');

    const payload = {
      body,
      commit_id: headSha,
      path: item.path,
      side: 'RIGHT',
      line: placement.line,
    };

    if (placement.startLine && placement.startLine < placement.line) {
      payload.start_line = placement.startLine;
      payload.start_side = 'RIGHT';
    }

    try {
      await githubApi(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${encodeURIComponent(pr)}/comments`, {
        method: 'POST',
        body: payload,
      });
      created += 1;
    } catch {
      unplaced.push(item);
    }
  }

  return { created, unplaced };
}

async function listPrFiles({ owner, name, pr }) {
  const files = [];
  let page = 1;
  while (true) {
    const pageData = await githubApi(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${encodeURIComponent(pr)}/files?per_page=100&page=${page}`,
    );
    files.push(...pageData);
    if (pageData.length < 100) {
      break;
    }
    page += 1;
  }
  return files;
}

async function listReviewComments({ owner, name, pr }) {
  const comments = [];
  let page = 1;
  while (true) {
    const pageData = await githubApi(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${encodeURIComponent(pr)}/comments?per_page=100&page=${page}`,
    );
    comments.push(...pageData);
    if (pageData.length < 100) {
      break;
    }
    page += 1;
  }
  return comments;
}

function parseAddedLines(patch) {
  const added = new Set();
  if (!patch) {
    return added;
  }

  const lines = patch.split('\n');
  let newLine = null;

  for (const line of lines) {
    const hunkMatch = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunkMatch) {
      newLine = Number.parseInt(hunkMatch[1], 10);
      continue;
    }

    if (newLine === null) {
      continue;
    }

    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.add(newLine);
      newLine += 1;
      continue;
    }

    if (line.startsWith('-') && !line.startsWith('---')) {
      continue;
    }

    if (line.startsWith(' ')) {
      newLine += 1;
    }
  }

  return added;
}

function resolvePlacement({ startLine, endLine, diffLines }) {
  const sortedLines = Array.from(diffLines).sort((a, b) => a - b);
  if (sortedLines.length === 0) {
    return null;
  }

  if (!Number.isInteger(startLine)) {
    return { line: sortedLines[0] };
  }

  const safeEnd = Number.isInteger(endLine) ? Math.max(endLine, startLine) : startLine;
  const inRange = sortedLines.filter((line) => line >= startLine && line <= safeEnd);
  if (inRange.length >= 2) {
    return { startLine: inRange[0], line: inRange[inRange.length - 1] };
  }
  if (inRange.length === 1) {
    return { line: inRange[0] };
  }

  if (diffLines.has(startLine)) {
    return { line: startLine };
  }

  return null;
}
