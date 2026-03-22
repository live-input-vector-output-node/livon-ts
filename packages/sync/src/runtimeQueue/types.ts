export type RuntimeQueueChannel = 'state' | 'storage' | 'lifecycle';
export type RuntimeQueueMode = 'fireAndForget' | 'sync';

export interface RuntimeQueueTask {
  channel: RuntimeQueueChannel;
  mode?: RuntimeQueueMode;
  key?: string;
  run: () => void;
}

export interface RuntimeQueue {
  enqueue: (task: RuntimeQueueTask) => void;
  flush: (channel?: RuntimeQueueChannel) => void;
}

export type RuntimeQueueBatchSizes = Partial<Record<RuntimeQueueChannel, number>>;

export interface RuntimeQueueScheduler {
  (callback: () => void): void;
}

export interface CreateRuntimeQueueInput {
  batchSizes?: RuntimeQueueBatchSizes;
  schedule?: RuntimeQueueScheduler;
}

