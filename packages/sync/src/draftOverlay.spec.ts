import { beforeEach, describe, expect, it, vi } from 'vitest';

import { entity, type Entity } from './entity.js';
import { source, type Source, type SourceUnit } from './source.js';
import { randomString } from './testing/randomData.js';

interface ProjectFlags {
  archived: boolean;
}

interface ProjectSettings {
  title: string;
  flags: ProjectFlags;
}

interface Project {
  id: string;
  name: string;
  templateId: string;
  settings: ProjectSettings;
}

interface ProjectSlug {
  templateId: string;
}

type DraftMode = 'global' | 'scoped' | 'off';

interface DraftUpdater<RResult, UUpdate> {
  (previous: RResult): UUpdate;
}

interface DraftApi<RResult, UUpdate extends RResult> {
  set: (input: UUpdate | DraftUpdater<RResult, UUpdate>) => void;
  clean: () => void;
}

interface DraftUnit<RResult, UUpdate extends RResult> {
  draft: DraftApi<RResult, UUpdate>;
}

type ProjectsEntity = Entity<Project>;
type ReadProjectSource = Source<ProjectSlug, undefined, Project>;
type ReadProjectsSource = Source<ProjectSlug, undefined, readonly Project[]>;
type ReadProjectUnit = SourceUnit<ProjectSlug, undefined, Project> & DraftUnit<Project, Project>;
type ReadProjectsUnit = SourceUnit<ProjectSlug, undefined, readonly Project[]> &
  DraftUnit<readonly Project[], readonly Project[]>;

interface SetupSourcesInput {
  draft?: DraftMode;
}

interface SetupEntityInput {
  draft?: DraftMode;
}

describe('draftOverlay', () => {
  let projectsEntity: ProjectsEntity;
  let readProjectApi = vi.fn();
  let readProjectsApi = vi.fn();
  let readProject: ReadProjectSource;
  let readProjects: ReadProjectsSource;
  let firstTemplateId: string;
  let secondTemplateId: string;
  let firstProjectId: string;
  let secondProjectId: string;
  let firstProjectName: string;
  let secondProjectName: string;
  let firstProjectTitle: string;
  let secondProjectTitle: string;
  let projectByTemplateId: Map<string, Project>;

  const createProject = (input: Project): Project => {
    return {
      id: input.id,
      name: input.name,
      templateId: input.templateId,
      settings: {
        title: input.settings.title,
        flags: {
          archived: input.settings.flags.archived,
        },
      },
    };
  };

  const createUnit = (templateId: string): ReadProjectUnit => {
    return readProject({ templateId }) as ReadProjectUnit;
  };

  const createManyUnit = (templateId: string): ReadProjectsUnit => {
    return readProjects({ templateId }) as ReadProjectsUnit;
  };

  const setupSources = ({ draft }: SetupSourcesInput): void => {
    readProject = source<ProjectSlug, undefined, Project>({
      entity: projectsEntity,
      ...(draft ? { draft } : {}),
      run: async ({ scope }) => {
        return readProjectApi(scope);
      },
    });

    readProjects = source<ProjectSlug, undefined, readonly Project[]>({
      entity: projectsEntity,
      ...(draft ? { draft } : {}),
      run: async ({ scope }) => {
        return readProjectsApi(scope);
      },
    });
  };

  const setupEntity = ({ draft }: SetupEntityInput): void => {
    const config = {
      idOf: (value: Project) => value.id,
      ...(draft ? { draft } : {}),
    };

    projectsEntity = entity<Project>(config);
  };

  beforeEach(() => {
    firstTemplateId = randomString({ prefix: 'template-id' });
    secondTemplateId = randomString({ prefix: 'template-id' });
    firstProjectId = randomString({ prefix: 'project-id' });
    secondProjectId = randomString({ prefix: 'project-id' });
    firstProjectName = randomString({ prefix: 'project-name' });
    secondProjectName = randomString({ prefix: 'project-name' });
    firstProjectTitle = randomString({ prefix: 'project-title' });
    secondProjectTitle = randomString({ prefix: 'project-title' });

    projectByTemplateId = new Map<string, Project>([
      [
        firstTemplateId,
        createProject({
          id: firstProjectId,
          name: firstProjectName,
          templateId: firstTemplateId,
          settings: {
            title: firstProjectTitle,
            flags: {
              archived: false,
            },
          },
        }),
      ],
      [
        secondTemplateId,
        createProject({
          id: secondProjectId,
          name: secondProjectName,
          templateId: secondTemplateId,
          settings: {
            title: secondProjectTitle,
            flags: {
              archived: false,
            },
          },
        }),
      ],
    ]);

    readProjectApi = vi.fn(async ({ templateId }) => {
      const project = projectByTemplateId.get(templateId);
      if (!project) {
        throw new Error('Project not found for template id.');
      }

      return createProject(project);
    });
    readProjectsApi = vi.fn(async ({ templateId }) => {
      const project = projectByTemplateId.get(templateId);
      if (!project) {
        return [];
      }

      return [createProject(project)];
    });

    setupEntity({});
    setupSources({});
  });

  describe('happy', () => {
    it('should expose draft.set and draft.clean methods on source unit', () => {
      const unit = createUnit(firstTemplateId);
      const unitApi = unit as unknown as Record<string, unknown>;
      const draftApi = unitApi.draft as Record<string, unknown> | undefined;

      expect(unitApi.setDraft).toBeUndefined();
      expect(unitApi.cleanDraft).toBeUndefined();
      expect(typeof draftApi?.set).toBe('function');
      expect(typeof draftApi?.clean).toBe('function');
    });

    it('should return draft overlay value when draft.set receives direct object', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const unit = createUnit(firstTemplateId);

      await unit.run();
      unit.draft.set({
        ...unit.get(),
        name: draftName,
      });

      expect(unit.get().name).toBe(draftName);
    });

    it('should not trigger draft overlay when draft.set receives equivalent one-value object instance', async () => {
      const unit = createUnit(firstTemplateId);
      const listener = vi.fn();

      await unit.run();
      unit.effect(listener);
      listener.mockClear();

      unit.draft.set({
        ...unit.get(),
      });

      expect(listener).toHaveBeenCalledTimes(0);
      expect(unit.get().name).toBe(firstProjectName);
    });

    it('should not trigger draft overlay when draft.set receives equivalent many-value array instance', async () => {
      const unit = createManyUnit(firstTemplateId);
      const listener = vi.fn();

      await unit.run();
      unit.effect(listener);
      listener.mockClear();

      unit.draft.set([
        ...unit.get(),
      ]);

      expect(listener).toHaveBeenCalledTimes(0);
      expect(unit.get()[0]?.name).toBe(firstProjectName);
    });

    it('should apply draft updater callback to current unit value', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const unit = createUnit(firstTemplateId);

      await unit.run();
      unit.draft.set((previous) => {
        return {
          ...previous,
          name: draftName,
        };
      });

      expect(unit.get().name).toBe(draftName);
    });

    it('should keep base value immutable when draft updater mutates nested draft object', async () => {
      const draftTitle = randomString({ prefix: 'draft-title' });
      const unit = createUnit(firstTemplateId);

      await unit.run();
      unit.draft.set((previous) => {
        previous.settings.title = draftTitle;
        return previous;
      });
      unit.draft.clean();

      expect(unit.get().settings.title).toBe(firstProjectTitle);
    });

    it('should share draft overlay between units created from same source and scope', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const firstUnit = createUnit(firstTemplateId);

      await firstUnit.run();
      firstUnit.draft.set({
        ...firstUnit.get(),
        name: draftName,
      });
      const secondUnit = createUnit(firstTemplateId);

      expect(secondUnit.get().name).toBe(draftName);
    });

    it('should not leak draft overlay to unit created from different scope', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const firstUnit = createUnit(firstTemplateId);
      const secondUnit = createUnit(secondTemplateId);

      await firstUnit.run();
      await secondUnit.run();
      firstUnit.draft.set({
        ...firstUnit.get(),
        name: draftName,
      });

      expect(secondUnit.get().name).toBe(secondProjectName);
    });

    it('should mirror one-source draft overlay into many-source value for same entity id in global mode', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);

      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });

      expect(manyUnit.get()[0]?.name).toBe(draftName);
    });

    it('should use global draft mode by default when draft config is omitted', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);

      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });

      expect(manyUnit.get()[0]?.name).toBe(draftName);
    });

    it('should clean draft globally across one-source and many-source values in global mode', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);

      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });
      oneUnit.draft.clean();

      expect(manyUnit.get()[0]?.name).toBe(firstProjectName);
    });

    it('should keep draft scoped per source when draft mode is scoped', async () => {
      const draftName = randomString({ prefix: 'draft-name' });

      setupSources({ draft: 'scoped' });
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);
      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });

      expect(manyUnit.get()[0]?.name).toBe(firstProjectName);
    });

    it('should fallback to entity draft mode when source draft mode is omitted', async () => {
      const draftName = randomString({ prefix: 'draft-name' });

      setupEntity({ draft: 'scoped' });
      setupSources({});
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);
      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });

      expect(manyUnit.get()[0]?.name).toBe(firstProjectName);
    });

    it('should let source draft mode override entity draft mode', async () => {
      const draftName = randomString({ prefix: 'draft-name' });

      setupEntity({ draft: 'scoped' });
      setupSources({ draft: 'global' });
      const oneUnit = createUnit(firstTemplateId);
      const manyUnit = createManyUnit(firstTemplateId);
      await oneUnit.run();
      await manyUnit.run();
      oneUnit.draft.set({
        ...oneUnit.get(),
        name: draftName,
      });

      expect(manyUnit.get()[0]?.name).toBe(draftName);
    });

    it('should let source off mode override entity global mode', async () => {
      const draftName = randomString({ prefix: 'draft-name' });

      setupEntity({ draft: 'global' });
      setupSources({ draft: 'off' });
      const unit = createUnit(firstTemplateId);
      await unit.run();
      unit.draft.set({
        ...unit.get(),
        name: draftName,
      });

      expect(unit.get().name).toBe(firstProjectName);
    });

    it('should disable overlay writes when draft mode is off', async () => {
      const draftName = randomString({ prefix: 'draft-name' });

      setupSources({ draft: 'off' });
      const unit = createUnit(firstTemplateId);
      await unit.run();
      unit.draft.set({
        ...unit.get(),
        name: draftName,
      });

      expect(unit.get().name).toBe(firstProjectName);
    });

    it('should keep draft overlay active while force refresh updates base value', async () => {
      const draftName = randomString({ prefix: 'draft-name' });
      const refreshedName = randomString({ prefix: 'refreshed-name' });
      const unit = createUnit(firstTemplateId);

      await unit.run();
      unit.draft.set({
        ...unit.get(),
        name: draftName,
      });
      projectByTemplateId.set(
        firstTemplateId,
        createProject({
          ...projectByTemplateId.get(firstTemplateId)!,
          name: refreshedName,
        }),
      );
      await unit.force();
      unit.draft.clean();

      expect(readProjectApi).toHaveBeenCalledTimes(2);
      expect(unit.get().name).toBe(refreshedName);
    });
  });
});
