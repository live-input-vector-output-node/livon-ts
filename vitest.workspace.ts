import { defineConfig } from 'vitest/config';
import { existsSync, readdirSync } from 'node:fs';

const scopes = ['apps', 'packages', 'tools'] as const;
const projectTypes = ['unit', 'integration'] as const;

const createWorkspaceProjects = () => {
  return scopes.flatMap((scope) => {
    return readdirSync(scope, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .flatMap((entry) => {
        return projectTypes
          .map((projectType) => {
            const configPath = `${scope}/${entry.name}/vitest.${projectType}.config.ts`;
            if (!existsSync(configPath)) {
              return null;
            }
            return {
              extends: `./${configPath}`,
              root: `${scope}/${entry.name}`,
              test: {
                name: `${scope}/${entry.name}:${projectType}`,
              },
            };
          })
          .filter((project) => project !== null);
      });
  });
};

export default defineConfig({
  test: {
    projects: createWorkspaceProjects(),
  },
});
