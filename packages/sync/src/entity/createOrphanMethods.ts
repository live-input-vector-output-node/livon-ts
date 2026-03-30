import type {
  CacheConfig,
  EntityByIdMap,
  EntityId,
  EntityUnitKeyInput,
} from './types.js';
import { resolveOrphanRetentionTtl } from './resolveOrphanRetentionTtl.js';
import { resolveTimeoutRuntime } from './resolveTimeoutRuntime.js';

interface CreateOrphanMethodsInput<
  TInput extends object,
  TId extends EntityId,
> {
  cache?: CacheConfig;
  ttl?: number;
  entitiesById: EntityByIdMap<TInput, TId>;
  unitKeysById: Map<TId, Set<string>>;
}

export interface ClearOrphanCleanupScheduleResult {
  expiresAt?: number;
  removedNextScheduled: boolean;
}

export interface OrphanMethods<
  TInput extends object,
  TId extends EntityId,
> {
  getById: (id: TId) => TInput | undefined;
  sweepExpiredOrphansIfNeeded: () => void;
  clearOrphanCleanupSchedule: (id: TId) => ClearOrphanCleanupScheduleResult;
  syncOrphanSweepTimeoutByScan: () => void;
  removeUnitKeyFromId: (input: EntityUnitKeyInput<TId>) => void;
  addUnitKeyToId: (input: EntityUnitKeyInput<TId>) => void;
}

export const createOrphanMethods = <
  TInput extends object,
  TId extends EntityId,
>({
  cache,
  ttl,
  entitiesById,
  unitKeysById,
}: CreateOrphanMethodsInput<TInput, TId>): OrphanMethods<TInput, TId> => {
  const orphanExpiresAtById = new Map<TId, number>();
  const timeoutRuntime = resolveTimeoutRuntime();
  const orphanRetentionTtl = resolveOrphanRetentionTtl({
    cache,
    ttl,
  });
  const shouldSweepOrphans = orphanRetentionTtl !== 'infinity';
  const shouldInlineOrphanSweep = shouldSweepOrphans && !timeoutRuntime;

  let orphanSweepTimeout: unknown | null = null;
  let orphanNextSweepAt: number | null = null;

  const hasEntitySubscribers = (id: TId): boolean => {
    const keys = unitKeysById.get(id);
    return Boolean(keys && keys.size > 0);
  };

  const clearActiveOrphanSweepTimeout = (): void => {
    if (orphanSweepTimeout !== null && timeoutRuntime) {
      timeoutRuntime.clearTimeout(orphanSweepTimeout);
    }

    orphanSweepTimeout = null;
    orphanNextSweepAt = null;
  };

  const resolveNextOrphanSweepAt = (): number | null => {
    let nextSweepAt: number | null = null;
    orphanExpiresAtById.forEach((expiresAt) => {
      if (nextSweepAt === null || expiresAt < nextSweepAt) {
        nextSweepAt = expiresAt;
      }
    });

    return nextSweepAt;
  };

  const scheduleOrphanSweepAt = (nextSweepAt: number): void => {
    if (!timeoutRuntime) {
      return;
    }

    if (
      orphanSweepTimeout !== null
      && orphanNextSweepAt !== null
      && orphanNextSweepAt <= nextSweepAt
    ) {
      return;
    }

    clearActiveOrphanSweepTimeout();
    orphanNextSweepAt = nextSweepAt;
    const delay = Math.max(0, nextSweepAt - Date.now());
    orphanSweepTimeout = timeoutRuntime.setTimeout(() => {
      orphanSweepTimeout = null;
      orphanNextSweepAt = null;
      sweepExpiredOrphans();
    }, delay);
  };

  const syncOrphanSweepTimeoutByScan = (): void => {
    const nextSweepAt = resolveNextOrphanSweepAt();
    if (nextSweepAt === null) {
      clearActiveOrphanSweepTimeout();
      return;
    }

    scheduleOrphanSweepAt(nextSweepAt);
  };

  const clearOrphanCleanupSchedule = (id: TId): ClearOrphanCleanupScheduleResult => {
    const expiresAt = orphanExpiresAtById.get(id);
    if (expiresAt === undefined) {
      return {
        removedNextScheduled: false,
      };
    }

    orphanExpiresAtById.delete(id);

    return {
      expiresAt,
      removedNextScheduled: orphanNextSweepAt !== null && orphanNextSweepAt === expiresAt,
    };
  };

  const removeOrphanEntityById = (id: TId): void => {
    if (hasEntitySubscribers(id)) {
      clearOrphanCleanupSchedule(id);
      return;
    }

    clearOrphanCleanupSchedule(id);
    entitiesById.delete(id);
  };

  const sweepExpiredOrphans = (): void => {
    if (orphanExpiresAtById.size === 0) {
      clearActiveOrphanSweepTimeout();
      return;
    }

    const now = Date.now();
    let hasExpired = false;

    orphanExpiresAtById.forEach((expiresAt, id) => {
      if (expiresAt > now) {
        return;
      }

      hasExpired = true;
      removeOrphanEntityById(id);
    });

    if (hasExpired) {
      syncOrphanSweepTimeoutByScan();
      return;
    }

    if (orphanSweepTimeout === null) {
      syncOrphanSweepTimeoutByScan();
    }
  };

  const sweepExpiredOrphansIfNeeded = (): void => {
    if (!shouldInlineOrphanSweep || orphanExpiresAtById.size === 0) {
      return;
    }

    sweepExpiredOrphans();
  };

  const scheduleOrphanCleanup = (id: TId): void => {
    if (hasEntitySubscribers(id)) {
      const { removedNextScheduled } = clearOrphanCleanupSchedule(id);
      if (removedNextScheduled) {
        syncOrphanSweepTimeoutByScan();
      }
      return;
    }

    if (orphanRetentionTtl === 'infinity') {
      const { removedNextScheduled } = clearOrphanCleanupSchedule(id);
      if (removedNextScheduled) {
        syncOrphanSweepTimeoutByScan();
      }
      return;
    }

    if (orphanRetentionTtl > 0) {
      const expiresAt = Date.now() + orphanRetentionTtl;
      orphanExpiresAtById.set(id, expiresAt);
      scheduleOrphanSweepAt(expiresAt);
      return;
    }

    removeOrphanEntityById(id);
    if (orphanSweepTimeout !== null) {
      syncOrphanSweepTimeoutByScan();
    }
  };

  const getById = shouldInlineOrphanSweep
    ? (id: TId): TInput | undefined => {
      sweepExpiredOrphansIfNeeded();
      return entitiesById.get(id);
    }
    : (id: TId): TInput | undefined => {
      return entitiesById.get(id);
    };

  const removeUnitKeyFromId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    sweepExpiredOrphansIfNeeded();
    const keys = unitKeysById.get(id);

    if (!keys) {
      return;
    }

    keys.delete(key);
    if (keys.size === 0) {
      unitKeysById.delete(id);
      scheduleOrphanCleanup(id);
    }
  };

  const addUnitKeyToId = ({
    id,
    key,
  }: EntityUnitKeyInput<TId>): void => {
    sweepExpiredOrphansIfNeeded();
    const { removedNextScheduled } = clearOrphanCleanupSchedule(id);
    if (removedNextScheduled) {
      syncOrphanSweepTimeoutByScan();
    }

    const existingKeys = unitKeysById.get(id);
    if (existingKeys) {
      existingKeys.add(key);
      return;
    }

    unitKeysById.set(id, new Set<string>([key]));
  };

  return {
    getById,
    sweepExpiredOrphansIfNeeded,
    clearOrphanCleanupSchedule,
    syncOrphanSweepTimeoutByScan,
    removeUnitKeyFromId,
    addUnitKeyToId,
  };
};
