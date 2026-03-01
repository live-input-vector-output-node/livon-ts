import { readFile } from 'node:fs/promises';
import { createPolicyContext } from './src/shared/context.ts';
import { readJson } from './src/shared/fs-utils.ts';
import { matchesAnyPattern, normalizePath, unique } from './src/shared/path-utils.ts';

interface RoutingRoute {
  readonly patterns: string[];
  readonly load: string[];
}

interface RoutingFixture {
  readonly path: string;
}

interface RoutingConfig {
  readonly alwaysLoad: string[];
  readonly baselineLoad: string[];
  readonly routes: RoutingRoute[];
  readonly fixtures: RoutingFixture[];
}

const resolveRouteLoadsForPath = (routingConfig: RoutingConfig, targetPath: string): string[] => {
  const normalizedTarget = normalizePath(targetPath);
  const matchingLoads = routingConfig.routes
    .filter((route) => matchesAnyPattern(normalizedTarget, route.patterns))
    .flatMap((route) => route.load);
  return unique([...routingConfig.alwaysLoad, ...matchingLoads]);
};

const run = async (): Promise<void> => {
  const context = createPolicyContext();
  const routingConfig = await readJson<RoutingConfig>(context.aiRoutingConfigPath);
  const rootAgents = await readFile(context.rootAgentsPath, 'utf8');
  const rootLoadMarkers = [...rootAgents.matchAll(/<!--\s*@agent\.load:/g)].length;

  const fixtureResolvedSizes = routingConfig.fixtures.map((fixture) =>
    resolveRouteLoadsForPath(routingConfig, fixture.path).length,
  );

  const fixtureLoadMin = fixtureResolvedSizes.length > 0 ? Math.min(...fixtureResolvedSizes) : 0;
  const fixtureLoadMax = fixtureResolvedSizes.length > 0 ? Math.max(...fixtureResolvedSizes) : 0;
  const fixtureLoadAvg =
    fixtureResolvedSizes.length > 0
      ? Number((fixtureResolvedSizes.reduce((sum, value) => sum + value, 0) / fixtureResolvedSizes.length).toFixed(2))
      : 0;

  const summary = {
    rootLoadMarkers,
    alwaysLoadCount: routingConfig.alwaysLoad.length,
    baselineLoadCount: routingConfig.baselineLoad.length,
    routeCount: routingConfig.routes.length,
    fixtureCount: routingConfig.fixtures.length,
    fixtureResolvedLoadMin: fixtureLoadMin,
    fixtureResolvedLoadMax: fixtureLoadMax,
    fixtureResolvedLoadAvg: fixtureLoadAvg,
  };

  console.log(JSON.stringify(summary, null, 2));
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
