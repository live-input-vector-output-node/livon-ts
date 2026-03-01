import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { exists, readJson } from '../shared/fs-utils.ts';
import { matchesAnyPattern, normalizePath, unique } from '../shared/path-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface RoutingRoute {
  readonly id: string;
  readonly patterns: string[];
  readonly load: string[];
}

interface RoutingFixture {
  readonly path: string;
  readonly mustLoad: string[];
}

interface RoutingEnforcement {
  readonly maxRootAgentLoads?: number;
  readonly maxActiveRules?: number;
  readonly maxAlwaysLoadItems?: number;
}

interface RoutingConfig {
  readonly alwaysLoad: string[];
  readonly baselineLoad: string[];
  readonly routes: RoutingRoute[];
  readonly fixtures: RoutingFixture[];
  readonly enforcement?: RoutingEnforcement;
}

const resolveRouteLoadsForPath = (routingConfig: RoutingConfig, targetPath: string): string[] => {
  const normalizedTarget = normalizePath(targetPath);
  const matchingLoads = routingConfig.routes
    .filter((route) => matchesAnyPattern(normalizedTarget, route.patterns))
    .flatMap((route) => route.load);
  return unique([...routingConfig.alwaysLoad, ...matchingLoads]);
};

export const runAiRoutingConfigCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];
  const info: string[] = [];
  const rawConfig = await readJson<RoutingConfig>(context.aiRoutingConfigPath).catch(() => null);

  if (!rawConfig) {
    return {
      id: 'ai-routing-config',
      errors: ['configs/ai/context-routing.json: invalid or unreadable JSON'],
    };
  }

  const routingConfig = rawConfig;
  const arraysToValidate: Array<[string, unknown]> = [
    ['alwaysLoad', routingConfig.alwaysLoad],
    ['baselineLoad', routingConfig.baselineLoad],
    ['routes', routingConfig.routes],
    ['fixtures', routingConfig.fixtures],
  ];

  arraysToValidate.forEach(([name, value]) => {
    if (!Array.isArray(value)) {
      errors.push(`configs/ai/context-routing.json: ${name} must be an array`);
    }
  });

  if (errors.length > 0) {
    return {
      id: 'ai-routing-config',
      errors,
    };
  }

  const allPaths = unique([
    ...routingConfig.alwaysLoad,
    ...routingConfig.baselineLoad,
    ...routingConfig.routes.flatMap((route) => route.load ?? []),
  ]);

  const missingPaths = await Promise.all(
    allPaths.map(async (relativePath) => {
      const absolutePath = path.join(context.baseDir, relativePath);
      return (await exists(absolutePath)) ? null : `configs/ai/context-routing.json: missing path ${relativePath}`;
    }),
  );
  errors.push(...missingPaths.filter((entry): entry is string => entry !== null));

  const routeIds = routingConfig.routes.map((route) => route.id);
  const duplicateRouteIds = routeIds.filter((routeId, index) => routeIds.indexOf(routeId) !== index);
  if (duplicateRouteIds.length > 0) {
    errors.push(`configs/ai/context-routing.json: duplicate route ids (${unique(duplicateRouteIds).join(', ')})`);
  }

  routingConfig.routes.forEach((route) => {
    if (typeof route.id !== 'string' || route.id.length === 0) {
      errors.push('configs/ai/context-routing.json: each route must define a non-empty id');
    }
    if (!Array.isArray(route.patterns) || route.patterns.length === 0) {
      errors.push(`configs/ai/context-routing.json: route ${route.id ?? '<unknown>'} must define patterns`);
    }
    if (!Array.isArray(route.load) || route.load.length === 0) {
      errors.push(`configs/ai/context-routing.json: route ${route.id ?? '<unknown>'} must define load paths`);
    }
  });

  routingConfig.fixtures.forEach((fixture) => {
    if (!fixture || typeof fixture.path !== 'string' || !Array.isArray(fixture.mustLoad)) {
      errors.push('configs/ai/context-routing.json: each fixture must define path and mustLoad');
      return;
    }

    const resolvedLoads = resolveRouteLoadsForPath(routingConfig, fixture.path);
    const missingLoads = fixture.mustLoad.filter((requiredPath) => !resolvedLoads.includes(requiredPath));
    if (missingLoads.length > 0) {
      errors.push(`configs/ai/context-routing.json: fixture ${fixture.path} misses loads: ${missingLoads.join(', ')}`);
    }
  });

  const enforcement = routingConfig.enforcement ?? {};
  const maxRootAgentLoads = enforcement.maxRootAgentLoads;
  const maxActiveRules = enforcement.maxActiveRules;
  const maxAlwaysLoadItems = enforcement.maxAlwaysLoadItems;

  if (typeof maxRootAgentLoads !== 'number' || maxRootAgentLoads < 1) {
    errors.push('configs/ai/context-routing.json: enforcement.maxRootAgentLoads must be a positive number');
  }
  if (typeof maxActiveRules !== 'number' || maxActiveRules < 1) {
    errors.push('configs/ai/context-routing.json: enforcement.maxActiveRules must be a positive number');
  }
  if (typeof maxAlwaysLoadItems !== 'number' || maxAlwaysLoadItems < 1) {
    errors.push('configs/ai/context-routing.json: enforcement.maxAlwaysLoadItems must be a positive number');
  }

  if (typeof maxAlwaysLoadItems === 'number' && routingConfig.alwaysLoad.length > maxAlwaysLoadItems) {
    errors.push(
      `configs/ai/context-routing.json: alwaysLoad count ${routingConfig.alwaysLoad.length} exceeds maxAlwaysLoadItems ${maxAlwaysLoadItems}`,
    );
  }

  const rootAgentsSource = await readFile(context.rootAgentsPath, 'utf8').catch(() => null);
  if (!rootAgentsSource) {
    errors.push('AGENTS.md: unable to read root AGENTS file for load budget check');
  } else if (typeof maxRootAgentLoads === 'number') {
    const rootLoadMarkers = [...rootAgentsSource.matchAll(/<!--\s*@agent\.load:/g)].length;
    if (rootLoadMarkers > maxRootAgentLoads) {
      errors.push(`AGENTS.md: @agent.load marker count ${rootLoadMarkers} exceeds maxRootAgentLoads ${maxRootAgentLoads}`);
    }
  }

  const activeRulesDocSource = await readFile(context.aiActiveRulesDocPath, 'utf8').catch(() => null);
  if (!activeRulesDocSource) {
    errors.push('website/docs/ai/active-rules-and-gates.md: unable to read active rules doc');
  } else if (typeof maxActiveRules === 'number' && !activeRulesDocSource.includes(`up to ${maxActiveRules}`)) {
    errors.push(`website/docs/ai/active-rules-and-gates.md: must state active rule cap as \"up to ${maxActiveRules}\"`);
  }

  info.push(
    `rootLoadMax=${maxRootAgentLoads ?? 'n/a'}`,
    `alwaysLoad=${routingConfig.alwaysLoad.length}`,
    `routes=${routingConfig.routes.length}`,
    `fixtures=${routingConfig.fixtures.length}`,
  );

  return {
    id: 'ai-routing-config',
    errors,
    info,
  };
};
