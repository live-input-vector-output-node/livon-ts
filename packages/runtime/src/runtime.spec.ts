import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { runtime } from './runtime.js';
import type { EmitInput, EventEnvelope, RuntimeRegistry } from './types.js';
import {
  createEmitInputMock,
  createRuntimeHookMock,
  createRuntimeModuleMock,
} from './testing/mocks/index.js';

const getRegistryFromModule = (
  moduleMock: ReturnType<typeof createRuntimeModuleMock>,
): RuntimeRegistry => {
  const call = moduleMock.register.mock.calls[0];
  if (!call) {
    throw new Error('runtime module should receive a registry during startup');
  }
  return call[0];
};

describe('runtime()', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should register runtime registry when runtime starts with module input', () => {
      const moduleMock = createRuntimeModuleMock();

      runtime(moduleMock);

      expect(moduleMock.register).toHaveBeenCalledTimes(1);
      const registry = getRegistryFromModule(moduleMock);
      expect(typeof registry.emitReceive).toBe('function');
      expect(typeof registry.emitSend).toBe('function');
      expect(typeof registry.emitError).toBe('function');
      expect(typeof registry.onReceive).toBe('function');
      expect(typeof registry.onSend).toBe('function');
      expect(typeof registry.onError).toBe('function');
      expect(typeof registry.state.get).toBe('function');
      expect(typeof registry.state.set).toBe('function');
    });

    it('should register runtime registry when runtime starts with modules array input', () => {
      const moduleMock = createRuntimeModuleMock();

      runtime({ modules: [moduleMock] });

      expect(moduleMock.register).toHaveBeenCalledTimes(1);
      expect(getRegistryFromModule(moduleMock)).toBeDefined();
    });

    it('should execute receive hooks in registration order when emitReceive is called', async () => {
      const hookOrder: string[] = [];
      const firstHook = createRuntimeHookMock(async (_envelope, _ctx, next) => {
        hookOrder.push('first');
        return next({ metadata: { first: true } });
      });
      const secondHook = createRuntimeHookMock(async (_envelope, _ctx, next) => {
        hookOrder.push('second');
        return next();
      });

      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onReceive(firstHook);
          registry.onReceive(secondHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(
        createEmitInputMock({ event: 'receive.event' }),
      );

      expect(ack).toEqual({ ok: true });
      expect(hookOrder).toEqual(['first', 'second']);
      expect(firstHook).toHaveBeenCalledTimes(1);
      const firstEnvelope = firstHook.mock.calls[0]?.[0] as EventEnvelope;
      expect(firstEnvelope.event).toBe('receive.event');
      expect(firstEnvelope.status).toBe('receiving');
    });

    it('should execute onSend hooks when emitEvent is called from receive context', async () => {
      const sendHook = createRuntimeHookMock((envelope, _ctx, next) => next(envelope));
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onReceive(async (_envelope, ctx, next) => {
            await ctx.emitEvent(createEmitInputMock({ event: 'nested.send' }));
            return next();
          });
          registry.onSend(sendHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(createEmitInputMock({ event: 'root.receive' }));

      expect(ack).toEqual({ ok: true });
      expect(sendHook).toHaveBeenCalledTimes(1);
      const sendEnvelope = sendHook.mock.calls[0]?.[0] as EventEnvelope;
      expect(sendEnvelope.event).toBe('nested.send');
      expect(sendEnvelope.status).toBe('sending');
    });

    it('should include room metadata when room context emits send event', async () => {
      const sendHook = createRuntimeHookMock((envelope, _ctx, next) => next(envelope));
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onReceive(async (_envelope, ctx, next) => {
            await ctx
              .room('team-alpha')
              .emitSend(createEmitInputMock({ event: 'room.send' }));
            return next();
          });
          registry.onSend(sendHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(createEmitInputMock({ event: 'root.receive' }));

      expect(ack).toEqual({ ok: true });
      const sendEnvelope = sendHook.mock.calls[0]?.[0] as EventEnvelope;
      expect(sendEnvelope.metadata).toEqual({ room: 'team-alpha' });
    });

    it('should stop calling receive hook when unsubscribe is executed', async () => {
      const receiveHook = createRuntimeHookMock((_envelope, _ctx, next) => next());
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          const subscription = registry.onReceive(receiveHook);
          subscription.unsub();
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(createEmitInputMock({ event: 'receive.event' }));

      expect(ack).toEqual({ ok: true });
      expect(receiveHook).not.toHaveBeenCalled();
    });
  });

  describe('sad', () => {
    it('should return failed ack and call onError when receive hook throws', async () => {
      const errorHook = vi.fn();
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onReceive(() => {
            throw new Error('receive failed');
          });
          registry.onError(errorHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(createEmitInputMock({ event: 'receive.event' }));

      expect(ack).toEqual({ ok: false, error: 'receive failed' });
      expect(errorHook).toHaveBeenCalledTimes(1);
      const errorEnvelope = errorHook.mock.calls[0]?.[1] as EventEnvelope;
      expect(errorEnvelope.status).toBe('receiving');
      expect(errorEnvelope.error?.message).toBe('receive failed');
    });

    it('should return failed ack and merged context when send hook throws with context payload', async () => {
      const errorHook = vi.fn();
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onSend(() => {
            throw {
              message: 'send failed',
              context: { source: 'send-hook' },
            };
          });
          registry.onError(errorHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitSend(
        createEmitInputMock({
          event: 'send.event',
          context: { requestId: 'req-1' },
        }),
      );

      expect(ack).toEqual({ ok: false, error: 'send failed' });
      expect(errorHook).toHaveBeenCalledTimes(1);
      const errorEnvelope = errorHook.mock.calls[0]?.[1] as EventEnvelope;
      expect(errorEnvelope.context).toEqual({
        requestId: 'req-1',
        source: 'send-hook',
      });
    });

    it('should call onError with unknown fallback when emitError input has no error', async () => {
      const errorHook = vi.fn();
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onError(errorHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitError(
        createEmitInputMock({
          event: 'error.event',
          payload: new Uint8Array([1]),
        }),
      );

      expect(ack).toEqual({ ok: true });
      expect(errorHook).toHaveBeenCalledTimes(1);
      const runtimeError = errorHook.mock.calls[0]?.[0] as { message?: string };
      const errorEnvelope = errorHook.mock.calls[0]?.[1] as EventEnvelope;
      expect(runtimeError.message).toBe('Unknown error');
      expect(errorEnvelope.error?.message).toBe('Unknown error');
    });

    it('should throw input error when emit input has neither payload nor error', async () => {
      const moduleMock = createRuntimeModuleMock();

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);
      const invalidInput = { event: 'invalid.event' } as unknown as EmitInput;

      await expect(registry.emitReceive(invalidInput)).rejects.toThrow(
        'Emit input must contain payload or error.',
      );
    });

    it('should continue onError chain when one error handler throws', async () => {
      const failingErrorHook = vi.fn(() => {
        throw new Error('secondary error');
      });
      const succeedingErrorHook = vi.fn();
      const moduleMock = createRuntimeModuleMock({
        register: (registry) => {
          registry.onReceive(() => {
            throw new Error('receive failed');
          });
          registry.onError(failingErrorHook);
          registry.onError(succeedingErrorHook);
        },
      });

      runtime(moduleMock);
      const registry = getRegistryFromModule(moduleMock);

      const ack = await registry.emitReceive(createEmitInputMock({ event: 'receive.event' }));

      expect(ack).toEqual({ ok: false, error: 'receive failed' });
      expect(failingErrorHook).toHaveBeenCalledTimes(1);
      expect(succeedingErrorHook).toHaveBeenCalledTimes(1);
    });
  });
});
