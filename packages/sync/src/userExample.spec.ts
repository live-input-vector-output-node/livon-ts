import { beforeEach, describe, expect, it, vi } from 'vitest';

import { action, type Action } from './action.js';
import { entity, type Entity } from './entity.js';
import { source, type Source } from './source.js';
import { stream, type Stream } from './stream.js';
import { mockApi } from './testing/mocks/mockApi.js';
import { randomString } from './testing/randomData.js';

interface Project {
  id: string;
  name: string;
  templateId: string;
}

interface TemplateSlug {
  templateId: string;
}

type ProjectEntity = Entity<Project>;
type ProjectsApi = ReturnType<typeof mockApi<Project>>;
type ReadProjectSource = Source<TemplateSlug, undefined, Project | null, Project>;
type UpdateProjectAction = Action<TemplateSlug, Project, Project | null, Project>;
type ProjectUpdatedStream = Stream<TemplateSlug, Project, Project | null, Project>;
interface ProjectSubscriptionEvent {
  data?: Project;
  error?: unknown;
}
interface ProjectSubscriptionObserver {
  (event: ProjectSubscriptionEvent): void;
}

describe('user example flow', () => {
  let projectEntity: ProjectEntity;
  let projectsApi: ProjectsApi;
  let findOneSpy = vi.fn();
  let updateSpy = vi.fn();
  let readProject: ReadProjectSource;
  let updateProject: UpdateProjectAction;
  let streamRunMock = vi.fn();
  let observeMock = vi.fn();
  let emitSubscriptionEvent: ProjectSubscriptionObserver;
  let unsubscribeMock = vi.fn();
  let onProjectUpdated: ProjectUpdatedStream;
  let projectId: string;
  let templateId: string;
  let baseName: string;
  let updatedName: string;
  let streamName: string;

  beforeEach(async () => {
    projectId = randomString({ prefix: 'project-id' });
    templateId = randomString({ prefix: 'template-id' });
    baseName = randomString({ prefix: 'project-base-name' });
    updatedName = randomString({ prefix: 'project-updated-name' });
    streamName = randomString({ prefix: 'project-stream-name' });

    projectsApi = mockApi<Project>();
    await projectsApi.insert({ id: projectId, name: baseName, templateId });

    findOneSpy = vi.spyOn(projectsApi, 'findOne');
    updateSpy = vi.spyOn(projectsApi, 'update');

    projectEntity = entity<Project>({
      idOf: (value) => value.id,
      ttl: 30_000,
    });

    readProject = source<TemplateSlug, undefined, Project, Project | null, Project>({
      entity: projectEntity,
      run: async ({ scope, upsertOne }) => {
        const project = await projectsApi.findOne(scope);

        if (project) {
          upsertOne(project);
        }
      },
    });

    updateProject = action<TemplateSlug, Project, Project, Project | null, Project>({
      entity: projectEntity,
      run: async ({ payload, upsertOne }) => {
        const updated = await projectsApi.update({ id: payload.id }, payload);

        if (updated) {
          upsertOne(updated, { merge: true });
        }
      },
    });

    emitSubscriptionEvent = () => undefined;
    unsubscribeMock = vi.fn();
    observeMock = vi.fn((observer: ProjectSubscriptionObserver) => {
      emitSubscriptionEvent = observer;
    });

    streamRunMock = vi.fn(async ({ scope, refetch, upsertOne }) => {
      const subscription = {
        observe: observeMock,
        unsubscribe: unsubscribeMock,
      };

      subscription.observe((event: ProjectSubscriptionEvent) => {
        const { data } = event;

        if (!data) {
          return;
        }

        upsertOne(data, { merge: true });
        void refetch(scope)();
      });

      return subscription.unsubscribe;
    });

    onProjectUpdated = stream<TemplateSlug, Project, Project, Project | null, Project, undefined, Project | null, Project>({
      entity: projectEntity,
      source: readProject,
      run: streamRunMock,
    });
  });

  describe('happy', () => {
    it('should call read api once when project source run is called once', async () => {
      const projectStore = readProject({ templateId });

      await projectStore.run();

      expect(findOneSpy).toHaveBeenCalledTimes(1);
    });

    it('should call read api with template scope when project source run is called', async () => {
      const projectStore = readProject({ templateId });

      await projectStore.run();

      expect(findOneSpy).toHaveBeenNthCalledWith(1, { templateId });
    });

    it('should call update api with edited value when action run is called', async () => {
      const projectStore = readProject({ templateId });
      const updateProjectStore = updateProject({ templateId });

      await projectStore.run();
      await updateProjectStore.run({
        id: projectId,
        name: updatedName,
        templateId,
      });

      expect(updateSpy).toHaveBeenNthCalledWith(
        1,
        { id: projectId },
        { id: projectId, name: updatedName, templateId },
      );
    });

    it('should reload project source when stream emits update for same template', async () => {
      const projectStore = readProject({ templateId });
      const projectUpdatedStream = onProjectUpdated({ templateId });

      await projectStore.run();
      projectUpdatedStream.start();
      emitSubscriptionEvent({
        data: { id: projectId, templateId, name: streamName },
      });
      await Promise.resolve();

      expect(findOneSpy).toHaveBeenCalledTimes(2);
    });

    it('should call stream run once when stream start is called once', () => {
      const projectUpdatedStream = onProjectUpdated({ templateId });

      projectUpdatedStream.start();

      expect(streamRunMock).toHaveBeenCalledTimes(1);
    });

    it('should call stream unsubscribe when stream stop is called', async () => {
      const projectUpdatedStream = onProjectUpdated({ templateId });

      projectUpdatedStream.start();
      await Promise.resolve();
      projectUpdatedStream.stop();

      expect(unsubscribeMock).toHaveBeenCalledTimes(1);
    });
  });
});
