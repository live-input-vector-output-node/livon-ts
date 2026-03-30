export interface EntityReadWriteInput {
  batch?: boolean;
  subview?: boolean;
}

export interface EntityReadWriteConfig {
  batch: boolean;
  subview: boolean;
}

export interface RunEntityWriteStrategyInput {
  strategy: EntityReadWriteConfig;
  changedIdCount: number;
  affectedKeyCount?: number;
  hasDuplicates?: boolean;
  batchThreshold: number;
  runImmediate: () => void;
  runBatched: () => void;
}

const DEFAULT_ENTITY_READ_WRITE_CONFIG: EntityReadWriteConfig = {
  batch: true,
  subview: true,
};

export const resolveEntityReadWriteConfig = (
  input?: EntityReadWriteInput,
): EntityReadWriteConfig => {
  if (!input) {
    return DEFAULT_ENTITY_READ_WRITE_CONFIG;
  }

  return {
    batch: input.batch ?? DEFAULT_ENTITY_READ_WRITE_CONFIG.batch,
    subview: input.subview ?? DEFAULT_ENTITY_READ_WRITE_CONFIG.subview,
  };
};

export const runEntityWriteStrategy = ({
  strategy,
  changedIdCount,
  affectedKeyCount = 0,
  hasDuplicates = false,
  batchThreshold,
  runImmediate,
  runBatched,
}: RunEntityWriteStrategyInput): void => {
  if (!strategy.batch) {
    runImmediate();
    return;
  }

  const shouldBatch = hasDuplicates
    || changedIdCount >= batchThreshold
    || affectedKeyCount >= batchThreshold;

  if (shouldBatch) {
    runBatched();
    return;
  }

  runImmediate();
};
