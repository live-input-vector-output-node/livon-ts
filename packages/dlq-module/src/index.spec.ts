import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type {
  EmitInput,
  EventEnvelope,
  RuntimeEventContext,
  RuntimeContext,
  RuntimeOnError,
  RuntimeRegistry,
} from '@livon/runtime';

import { dlqModule } from './index.js';

interface RegistryMockBundle {
  registry: RuntimeRegistry;
  emitReceive: ReturnType<typeof vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>>;
  emitSend: ReturnType<typeof vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>>;
  onErrorRegister: ReturnType<typeof vi.fn<(hook: RuntimeOnError) => { unsub: () => void }>>;
  getOnErrorHook: () => RuntimeOnError;
}

const createRegistryMock = (): RegistryMockBundle => {
  let capturedOnError: RuntimeOnError | undefined;
  const emitReceive = vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>(async () => ({
    ok: true,
  }));
  const emitSend = vi.fn<(input: EmitInput) => Promise<{ ok: boolean }>>(async () => ({
    ok: true,
  }));
  const onErrorRegister = vi.fn<(hook: RuntimeOnError) => { unsub: () => void }>(
    (hook: RuntimeOnError) => {
      capturedOnError = hook;
      return { unsub: vi.fn() };
    },
  );

  const registry: RuntimeRegistry = {
    emitReceive,
    emitSend,
    emitError: vi.fn(async () => ({ ok: true })),
    onReceive: vi.fn(() => ({ unsub: vi.fn() })),
    onSend: vi.fn(() => ({ unsub: vi.fn() })),
    onError: onErrorRegister,
    state: {
      get: vi.fn(() => undefined),
      set: vi.fn(() => undefined),
    },
  };

  return {
    registry,
    emitReceive,
    emitSend,
    onErrorRegister,
    getOnErrorHook: () => {
      if (!capturedOnError) {
        throw new Error('onError hook must be registered before use');
      }
      return capturedOnError;
    },
  };
};

const createEnvelope = (
  overrides: Partial<EventEnvelope> = {},
): EventEnvelope => ({
  id: overrides.id ?? 'evt-1',
  event: overrides.event ?? 'user.updated',
  status: overrides.status ?? 'sending',
  metadata: overrides.metadata,
  context: overrides.context,
  payload: overrides.payload ?? new Uint8Array([1, 2, 3]),
  ...(overrides.error ? { error: overrides.error } : {}),
});

const runtimeContextMock = {
  emitEvent: vi.fn(async () => ({ ok: true })),
  emitReceive: vi.fn(async () => ({ ok: true })),
  emitSend: vi.fn(async () => ({ ok: true })),
  emitError: vi.fn(async () => ({ ok: true })),
  room: vi.fn(),
  state: {
    get: vi.fn(() => undefined),
    set: vi.fn(() => undefined),
  },
} as unknown as RuntimeContext;

const asRuntimeContext = (value: Record<string, unknown>) =>
  value as unknown as RuntimeEventContext;

describe('dlqModule()', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('happy', () => {
    it('should return default module name when custom name is not provided', () => {
      const module = dlqModule({
        maxAttempts: 3,
        storeBrokenEvent: vi.fn(),
        countPendingEvents: vi.fn(() => 0),
        loadReadyEvents: vi.fn(() => []),
      });

      expect(module.name).toBe('dlq-module');
      expect(typeof module.register).toBe('function');
    });

    it('should return custom module name when name option is provided', () => {
      const module = dlqModule({
        name: 'custom-dlq',
        maxAttempts: 3,
        storeBrokenEvent: vi.fn(),
        countPendingEvents: vi.fn(() => 0),
        loadReadyEvents: vi.fn(() => []),
      });

      expect(module.name).toBe('custom-dlq');
    });

    it('should store broken event and replay ready events when onError is triggered', async () => {
      const storeBrokenEvent = vi.fn<(event: unknown) => Promise<void>>(async () => undefined);
      const countPendingEvents = vi
        .fn()
        .mockReturnValueOnce(1)
        .mockReturnValue(0);
      const loadReadyEvents = vi.fn(() => [
        {
          ...createEnvelope({
            id: 'evt-receive',
            status: 'receiving',
            context: asRuntimeContext({ source: 'client' }),
          }),
          timestamp: Date.now(),
          error: { message: 'retry receive' },
        },
        {
          ...createEnvelope({
            id: 'evt-send',
            status: 'sending',
            context: asRuntimeContext({ source: 'server' }),
          }),
          timestamp: Date.now(),
          error: { message: 'retry send' },
        },
        {
          ...createEnvelope({
            id: 'evt-final',
            status: 'failed',
            context: asRuntimeContext({ source: 'final' }),
            error: { message: 'finalized' },
          }),
          timestamp: Date.now(),
          error: { message: 'finalized' },
        },
      ]);

      const module = dlqModule({
        maxAttempts: 3,
        tickIntervalMs: 10,
        storeBrokenEvent,
        countPendingEvents,
        loadReadyEvents,
      });
      const registryMock = createRegistryMock();

      module.register(registryMock.registry);
      const onError = registryMock.getOnErrorHook();
      onError(new Error('processing failed'), createEnvelope(), runtimeContextMock);

      await vi.advanceTimersByTimeAsync(20);

      expect(storeBrokenEvent).toHaveBeenCalledTimes(1);
      const storedEvent = storeBrokenEvent.mock.calls[0]?.[0] as EventEnvelope & {
        context?: { dlq?: { attempts: number; maxAttempts: number; final: boolean } };
      };
      expect(storedEvent.error).toMatchObject({
        message: 'processing failed',
        name: 'Error',
      });
      expect(storedEvent.status).toBe('sending');
      expect(storedEvent.context?.dlq).toMatchObject({
        attempts: 1,
        maxAttempts: 3,
        final: false,
      });

      expect(countPendingEvents).toHaveBeenCalledTimes(2);
      expect(loadReadyEvents).toHaveBeenCalledTimes(1);
      expect(registryMock.emitReceive).toHaveBeenCalledTimes(1);
      expect(registryMock.emitSend).toHaveBeenCalledTimes(1);
      expect(registryMock.emitReceive).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-receive',
          event: 'user.updated',
          status: 'receiving',
        }),
      );
      expect(registryMock.emitSend).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'evt-send',
          event: 'user.updated',
          status: 'sending',
        }),
      );
    });

    it('should stop ticker when pending count is zero after first tick', async () => {
      const countPendingEvents = vi.fn(() => 0);
      const loadReadyEvents = vi.fn(() => []);
      const module = dlqModule({
        maxAttempts: 3,
        tickIntervalMs: 5,
        storeBrokenEvent: vi.fn(),
        countPendingEvents,
        loadReadyEvents,
      });
      const registryMock = createRegistryMock();

      module.register(registryMock.registry);
      registryMock.getOnErrorHook()(
        'failure',
        createEnvelope(),
        runtimeContextMock,
      );

      await vi.advanceTimersByTimeAsync(20);
      await vi.advanceTimersByTimeAsync(20);

      expect(countPendingEvents).toHaveBeenCalledTimes(1);
      expect(loadReadyEvents).not.toHaveBeenCalled();
    });
  });

  describe('sad', () => {
    it('should fallback maxAttempts to one when maxAttempts is invalid', () => {
      const storeBrokenEvent = vi.fn<(event: unknown) => void>(() => undefined);
      const module = dlqModule({
        maxAttempts: 0,
        storeBrokenEvent,
        countPendingEvents: vi.fn(() => 0),
        loadReadyEvents: vi.fn(() => []),
      });
      const registryMock = createRegistryMock();

      module.register(registryMock.registry);
      registryMock.getOnErrorHook()(
        'failure',
        createEnvelope(),
        runtimeContextMock,
      );

      const stored = storeBrokenEvent.mock.calls[0]?.[0] as EventEnvelope & {
        context?: { dlq?: { maxAttempts: number; final: boolean } };
      };
      expect(stored.status).toBe('failed');
      expect(stored.context?.dlq).toMatchObject({ maxAttempts: 1, final: true });
    });

    it('should preserve envelope error when envelope already has error', () => {
      const storeBrokenEvent = vi.fn<(event: unknown) => void>(() => undefined);
      const module = dlqModule({
        maxAttempts: 3,
        storeBrokenEvent,
        countPendingEvents: vi.fn(() => 0),
        loadReadyEvents: vi.fn(() => []),
      });
      const registryMock = createRegistryMock();
      const existingError = { message: 'existing error' };

      module.register(registryMock.registry);
      registryMock.getOnErrorHook()(
        'ignored error input',
        createEnvelope({
          status: 'failed',
          error: existingError,
        }),
        runtimeContextMock,
      );

      const stored = storeBrokenEvent.mock.calls[0]?.[0] as EventEnvelope;
      expect(stored.error).toEqual(existingError);
    });

    it('should swallow storeBrokenEvent failures when storeBrokenEvent rejects', async () => {
      const module = dlqModule({
        maxAttempts: 3,
        tickIntervalMs: 5,
        storeBrokenEvent: vi.fn(async () => {
          throw new Error('store failed');
        }),
        countPendingEvents: vi.fn(() => 0),
        loadReadyEvents: vi.fn(() => []),
      });
      const registryMock = createRegistryMock();

      module.register(registryMock.registry);

      expect(() => {
        registryMock.getOnErrorHook()(
          new Error('processing failed'),
          createEnvelope(),
          runtimeContextMock,
        );
      }).not.toThrow();

      await vi.advanceTimersByTimeAsync(10);
    });
  });
});
