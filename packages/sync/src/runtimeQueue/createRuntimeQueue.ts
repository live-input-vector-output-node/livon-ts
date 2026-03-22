import { scheduleAsync } from '../utils/scheduleAsync.js';

import type {
  CreateRuntimeQueueInput,
  RuntimeQueue,
  RuntimeQueueChannel,
  RuntimeQueueMode,
  RuntimeQueueScheduler,
  RuntimeQueueTask,
} from './types.js';

interface RuntimeQueueTaskInternal {
  run: RuntimeQueueTaskRunner;
}

interface RuntimeQueueTaskRunner {
  (): void;
}

type RuntimeQueueChannelMap = Map<string, RuntimeQueueTaskInternal>;

const DEFAULT_BATCH_SIZE = 50;
const DEFAULT_MODE: RuntimeQueueMode = 'fireAndForget';
const CHANNELS: readonly RuntimeQueueChannel[] = ['state', 'storage', 'lifecycle'];

const createDeferredSchedule = (): RuntimeQueueScheduler => {
  return (callback) => {
    scheduleAsync({ callback });
  };
};

const createChannelTaskMap = (): Record<RuntimeQueueChannel, RuntimeQueueChannelMap> => {
  return {
    state: new Map<string, RuntimeQueueTaskInternal>(),
    storage: new Map<string, RuntimeQueueTaskInternal>(),
    lifecycle: new Map<string, RuntimeQueueTaskInternal>(),
  };
};

interface ResolveBatchSizeInput {
  channel: RuntimeQueueChannel;
  batchSizes: CreateRuntimeQueueInput['batchSizes'];
}

const resolveBatchSize = ({
  channel,
  batchSizes,
}: ResolveBatchSizeInput): number => {
  const configuredBatchSize = batchSizes?.[channel];
  if (configuredBatchSize && configuredBatchSize > 0) {
    return configuredBatchSize;
  }

  return DEFAULT_BATCH_SIZE;
};

export const createRuntimeQueue = ({
  batchSizes,
  schedule = createDeferredSchedule(),
}: CreateRuntimeQueueInput = {}): RuntimeQueue => {
  const channelTaskMap = createChannelTaskMap();
  const scheduledChannels = new Set<RuntimeQueueChannel>();
  let nextTaskId = 0;

  const runTask = (task: RuntimeQueueTaskInternal): void => {
    try {
      task.run();
    } catch {
      return;
    }
  };

  const runBatch = (channel: RuntimeQueueChannel): void => {
    const tasks = channelTaskMap[channel];
    const batchSize = resolveBatchSize({
      channel,
      batchSizes,
    });
    const taskEntries = Array.from(tasks.entries());
    const batchEntries = taskEntries.slice(0, batchSize);

    batchEntries.forEach(([key]) => {
      tasks.delete(key);
    });

    batchEntries.forEach(([, task]) => {
      runTask(task);
    });
  };

  const flushChannel = (channel: RuntimeQueueChannel): void => {
    if (channelTaskMap[channel].size === 0) {
      return;
    }

    runBatch(channel);
    flushChannel(channel);
  };

  const scheduleChannel = (channel: RuntimeQueueChannel): void => {
    if (scheduledChannels.has(channel)) {
      return;
    }

    scheduledChannels.add(channel);
    schedule(() => {
      scheduledChannels.delete(channel);
      runBatch(channel);

      if (channelTaskMap[channel].size > 0) {
        scheduleChannel(channel);
      }
    });
  };

  const createTaskKey = (task: RuntimeQueueTask): string => {
    if (task.key) {
      return task.key;
    }

    nextTaskId += 1;
    return `${task.channel}:${nextTaskId}`;
  };

  const enqueue = (task: RuntimeQueueTask): void => {
    const channel = task.channel;
    const mode = task.mode ?? DEFAULT_MODE;
    const key = createTaskKey(task);

    channelTaskMap[channel].set(key, {
      run: task.run,
    });

    if (mode === 'sync') {
      flushChannel(channel);
      return;
    }

    scheduleChannel(channel);
  };

  const flush = (channel?: RuntimeQueueChannel): void => {
    if (channel) {
      flushChannel(channel);
      return;
    }

    CHANNELS.forEach((currentChannel) => {
      flushChannel(currentChannel);
    });
  };

  return {
    enqueue,
    flush,
  };
};
