/**
 * Public package entrypoint for `@livon/dlq-module`.
 *
 * @see https://livon.tech/docs/packages/dlq-module
 */
import type {
  EmitInput,
  EventEnvelope,
  EventError,
  RuntimeEventContext,
  RuntimeModule,
  RuntimeRegistry,
} from '@livon/runtime';

const DEFAULT_MODULE_NAME = 'dlq-module';
const DEFAULT_TICK_INTERVAL_MS = 1_000;

export interface DlqContext {
  attempts: number;
  maxAttempts: number;
  firstErrorAt: number;
  lastErrorAt: number;
  final: boolean;
}

declare module '@livon/runtime' {
  interface RuntimeEventContext {
    dlq?: DlqContext;
  }
}

type RuntimeEventContextRecord = RuntimeEventContext & Record<string, unknown>;
type TimerHandle = ReturnType<typeof setInterval>;
type ReplayStatus = 'sending' | 'receiving';

export type DlqStoredEvent = EventEnvelope & {
  timestamp: number;
  error: EventError;
};

export interface DlqStoreBrokenEvent {
  (brokenEvent: DlqStoredEvent): Promise<void> | void;
}

export interface DlqCountPendingEvents {
  (): Promise<number> | number;
}

export interface DlqLoadReadyEvents {
  (): Promise<readonly DlqStoredEvent[]> | readonly DlqStoredEvent[];
}

export interface DlqModuleOptions {
  maxAttempts: number;
  storeBrokenEvent: DlqStoreBrokenEvent;
  countPendingEvents: DlqCountPendingEvents;
  loadReadyEvents: DlqLoadReadyEvents;
  tickIntervalMs?: number;
  name?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const contextRecordFrom = (context?: RuntimeEventContext): RuntimeEventContextRecord | undefined => {
  if (!context || !isRecord(context)) {
    return undefined;
  }
  return context as RuntimeEventContextRecord;
};

const errorFromUnknown = (error: unknown): EventError => {
  if (error instanceof Error) {
    return {
      message: error.message,
      ...(error.name ? { name: error.name } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (isRecord(error)) {
    const message = typeof error.message === 'string' ? error.message : 'Unknown error';
    const name = typeof error.name === 'string' ? error.name : undefined;
    const stack = typeof error.stack === 'string' ? error.stack : undefined;
    return {
      message,
      ...(name ? { name } : {}),
      ...(stack ? { stack } : {}),
    };
  }
  return { message: 'Unknown error' };
};

interface IntegerOrFallbackInput {
  value?: number;
  fallback: number;
}

const integerOrFallback = ({ value, fallback }: IntegerOrFallbackInput): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const rounded = Math.floor(value);
  if (rounded <= 0) {
    return fallback;
  }
  return rounded;
};

const replayStatusFromEnvelope = (envelope: EventEnvelope): ReplayStatus => {
  if (envelope.status === 'receiving') {
    return 'receiving';
  }
  return 'sending';
};

const dlqContextFromContext = (context?: RuntimeEventContext): DlqContext | undefined => {
  const contextRecord = contextRecordFrom(context);
  if (!contextRecord || !isRecord(contextRecord.dlq)) {
    return undefined;
  }
  const attempts = contextRecord.dlq.attempts;
  const maxAttempts = contextRecord.dlq.maxAttempts;
  const firstErrorAt = contextRecord.dlq.firstErrorAt;
  const lastErrorAt = contextRecord.dlq.lastErrorAt;
  const final = contextRecord.dlq.final;
  if (
    typeof attempts !== 'number'
    || !Number.isFinite(attempts)
    || typeof maxAttempts !== 'number'
    || !Number.isFinite(maxAttempts)
    || typeof firstErrorAt !== 'number'
    || !Number.isFinite(firstErrorAt)
    || typeof lastErrorAt !== 'number'
    || !Number.isFinite(lastErrorAt)
    || typeof final !== 'boolean'
  ) {
    return undefined;
  }
  return {
    attempts,
    maxAttempts,
    firstErrorAt,
    lastErrorAt,
    final,
  };
};

const withDlqContext = (context: RuntimeEventContext | undefined, dlq: DlqContext): RuntimeEventContext => {
  const base = contextRecordFrom(context);
  return {
    ...(base ?? {}),
    dlq,
  };
};

interface BuildBrokenEventInput {
  envelope: EventEnvelope;
  error: unknown;
  maxAttempts: number;
  timestamp: number;
}

const buildBrokenEvent = (input: BuildBrokenEventInput): DlqStoredEvent => {
  const { envelope, error: inputError, maxAttempts, timestamp } = input;
  const previousDlq = dlqContextFromContext(envelope.context);
  const attempts = (previousDlq?.attempts ?? 0) + 1;
  const final = attempts >= maxAttempts;
  const replayStatus = replayStatusFromEnvelope(envelope);
  const nextStatus = final ? 'failed' : replayStatus;
  const error = envelope.error ?? errorFromUnknown(inputError);
  const nextDlq: DlqContext = {
    attempts,
    maxAttempts,
    firstErrorAt: previousDlq?.firstErrorAt ?? timestamp,
    lastErrorAt: timestamp,
    final,
  };
  const { context, ...envelopeWanted } = envelope;
  return {
    ...envelopeWanted,
    status: nextStatus,
    error,
    context: withDlqContext(context, nextDlq),
    timestamp,
  };
};

const replayInputFromStoredEvent = (storedEvent: DlqStoredEvent): EmitInput => {
  const base = {
    id: storedEvent.id,
    event: storedEvent.event,
    status: storedEvent.status,
    metadata: storedEvent.metadata,
    context: storedEvent.context,
  };
  if ('payload' in storedEvent && storedEvent.payload !== undefined) {
    return {
      ...base,
      payload: storedEvent.payload,
      error: storedEvent.error,
    };
  }
  return {
    ...base,
    error: storedEvent.error,
  };
};

interface ReplayStoredEventInput {
  event: DlqStoredEvent;
  registry: RuntimeRegistry;
}

const replayStoredEvent = async (input: ReplayStoredEventInput) => {
  if (input.event.status === 'failed') {
    return;
  }
  const replayInput = replayInputFromStoredEvent(input.event);
  if (input.event.status === 'receiving') {
    await input.registry.emitReceive(replayInput);
    return;
  }
  await input.registry.emitSend(replayInput);
};

/**
 * dlqModule is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/dlq-module
 *
 * @example
 * const result = dlqModule(undefined as never);
 */
export const dlqModule = (options: DlqModuleOptions): RuntimeModule => {
  const name = options.name ?? DEFAULT_MODULE_NAME;
  const maxAttempts = integerOrFallback({ value: options.maxAttempts, fallback: 1 });
  const tickIntervalMs = integerOrFallback({
    value: options.tickIntervalMs,
    fallback: DEFAULT_TICK_INTERVAL_MS,
  });

  const register = (registry: RuntimeRegistry) => {
    let ticker: TimerHandle | undefined;
    let tickRunning = false;

    const stopTicker = () => {
      if (!ticker) {
        return;
      }
      clearInterval(ticker);
      ticker = undefined;
    };

    const runTick = async () => {
      if (tickRunning) {
        return;
      }
      tickRunning = true;
      try {
        const pendingCount = await Promise.resolve(options.countPendingEvents());
        if (pendingCount <= 0) {
          stopTicker();
          return;
        }
        const readyEvents = await Promise.resolve(options.loadReadyEvents());
        await Promise.all(
          readyEvents.map((event) =>
            replayStoredEvent({
              event,
              registry,
            })),
        );
      } finally {
        tickRunning = false;
      }
    };

    const ensureTicker = () => {
      if (ticker) {
        return;
      }
      ticker = setInterval(() => {
        void runTick();
      }, tickIntervalMs);
    };

    registry.onError((error, envelope) => {
      const timestamp = Date.now();
      const brokenEvent = buildBrokenEvent({
        envelope,
        error,
        maxAttempts,
        timestamp,
      });
      void Promise.resolve(options.storeBrokenEvent(brokenEvent)).catch(() => undefined);
      ensureTicker();
    });
  };

  return {
    name,
    register,
  };
};
