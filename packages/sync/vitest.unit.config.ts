import { createVitestConfig } from '@livon/config/vitest/base.cjs';

const base = createVitestConfig({
  type: 'unit',
});

export default {
  ...base,
  test: {
    ...base.test,
    include: [
      'src/dxTypeContracts.spec.ts',
      'src/entity.spec.ts',
      'src/entityDx.spec.ts',
      'src/indexExports.spec.ts',
      'src/memoization.spec.ts',
      'src/runSetAction.spec.ts',
      'src/runtimeUtils.spec.ts',
      'src/runtimeQueue/runtimeQueue.spec.ts',
      'src/tracking/destroyScheduler.spec.ts',
      'src/utils/adaptiveReadWrite.spec.ts',
      'src/utils/cloneValue.spec.ts',
      'src/utils/dependencyCache.spec.ts',
      'src/utils/entityMembership.spec.ts',
      'src/utils/entityMode.spec.ts',
      'src/utils/indexedDbCacheStorage.spec.ts',
      'src/utils/readWriteStrategy.spec.ts',
      'src/utils/runContextEntryCache.spec.ts',
      'src/utils/scheduleAsync.spec.ts',
      'src/utils/serializedKeyCache.spec.ts',
      'src/utils/structuredSerialization.spec.ts',
    ],
  },
};
