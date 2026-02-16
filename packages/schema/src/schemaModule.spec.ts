import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { api } from './api.js';
import { operation, fieldOperation } from './operation.js';
import { schemaModule, type SchemaModuleLike } from './schemaModule.js';
import { createBaseSchemaMock } from './testing/mocks/index.js';
import type { EventEnvelope, RuntimeContext, RuntimeRegistry } from '@livon/runtime';

type ModuleOperation = SchemaModuleLike['operations'][string];
type ModuleFieldOperation = SchemaModuleLike['fieldOperations'][string];

interface RegistryHookState {
  onReceive?: (envelope: EventEnvelope, ctx: RuntimeContext, next: RuntimeNext) => Promise<EventEnvelope>;
}

interface RuntimeNext {
  (update?: Partial<EventEnvelope>): Promise<EventEnvelope>;
}

const createRuntimeContextMock = (): RuntimeContext => {
  const runtimeContext = {} as RuntimeContext;
  runtimeContext.emitEvent = vi.fn(async () => ({ ok: true }));
  runtimeContext.emitReceive = vi.fn(async () => ({ ok: true }));
  runtimeContext.emitSend = vi.fn(async () => ({ ok: true }));
  runtimeContext.emitError = vi.fn(async () => ({ ok: true }));
  runtimeContext.state = {
    get: vi.fn(() => undefined),
    set: vi.fn(() => undefined),
  };
  runtimeContext.room = vi.fn(() => runtimeContext);
  return runtimeContext;
};

const createEnvelope = (overrides: Partial<EventEnvelope> = {}): EventEnvelope => ({
  id: 'evt-1',
  event: 'unknown',
  status: 'receiving',
  payload: new Uint8Array([1]),
  ...overrides,
});

const createRegistryMock = (state: RegistryHookState): RuntimeRegistry => ({
  onReceive: vi.fn((hook) => {
    state.onReceive = hook as RegistryHookState['onReceive'];
    return { unsub: () => undefined };
  }),
  onSend: vi.fn(() => ({ unsub: () => undefined })),
  onError: vi.fn(() => ({ unsub: () => undefined })),
  emitReceive: vi.fn(async () => ({ ok: true })),
  emitSend: vi.fn(async () => ({ ok: true })),
  emitError: vi.fn(async () => ({ ok: true })),
  state: {
    get: vi.fn(() => undefined),
    set: vi.fn(() => undefined),
  },
});

const createSchemaModuleLike = (overrides: Partial<SchemaModuleLike> = {}): SchemaModuleLike => ({
  operations: {},
  fieldOperations: {},
  subscriptions: {},
  ast: () => ({ type: 'api' }),
  ...overrides,
});

describe('schemaModule utilities', () => {
  let runtimeContext: RuntimeContext;

  beforeAll(() => {
    runtimeContext = createRuntimeContextMock();
  });

  beforeEach(() => {
    runtimeContext = createRuntimeContextMock();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('schemaModule()', () => {
    describe('happy', () => {
      it('should accept api schema directly when schemaModule is created from api schema', () => {
        const inputSchema = createBaseSchemaMock<{ id: string }>({
          outputValue: { id: 'u-1' },
        });
        const apiSchema = api({
          operations: {
            ping: operation({
              input: inputSchema,
              exec: async () => ({ id: 'u-1' }),
            }),
          },
          subscriptions: {},
        });
        const module = schemaModule(apiSchema);
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);

        module.register(registry);

        expect(module.name).toBe('schema');
        expect(registry.onReceive).toHaveBeenCalledTimes(1);
        expect(typeof state.onReceive).toBe('function');
      });

      it('should register onReceive hook when runtime module register is called', () => {
        const module = schemaModule(createSchemaModuleLike());
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);

        module.register(registry);

        expect(module.name).toBe('schema');
        expect(registry.onReceive).toHaveBeenCalledTimes(1);
        expect(typeof state.onReceive).toBe('function');
      });

      it('should emit explain payload when explain option is enabled and explain event is received', async () => {
        const encode = vi.fn(() => new Uint8Array([9]));
        const module = schemaModule(
          createSchemaModuleLike({
            ast: () => ({ type: 'api', name: 'RootApi' }),
          }),
          {
            explain: true,
            now: () => 1700000000000,
            encoder: encode,
          },
        );
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);
        module.register(registry);
        const next = vi.fn(async () => createEnvelope());

        await state.onReceive?.(
          createEnvelope({
            event: '$explain',
            metadata: { ifNoneMatch: 'different-checksum' },
          }),
          runtimeContext,
          next,
        );

        expect(next).not.toHaveBeenCalled();
        expect(runtimeContext.emitEvent).toHaveBeenCalledTimes(1);
        expect(encode).toHaveBeenCalledTimes(1);
      });

      it('should execute operation and emit operation response when operation event matches schema operation', async () => {
        const decodedInput = { id: 'u-1' };
        const decodedOutput = { result: 'ok' };
        const decode = vi.fn(() => decodedInput);
        const encode = vi.fn(() => new Uint8Array([7]));
        const inputSchema = createBaseSchemaMock<typeof decodedInput>({
          outputValue: decodedInput,
        });
        const outputSchema = createBaseSchemaMock<typeof decodedOutput>({
          outputValue: decodedOutput,
        });
        const exec = vi.fn(async () => decodedOutput);
        const module = schemaModule(
          createSchemaModuleLike({
            operations: {
              ping: operation({
                input: inputSchema,
                output: outputSchema,
                exec,
              }) as ModuleOperation,
            },
            fieldOperations: {},
            subscriptions: {},
            ast: () => ({ type: 'api' }),
          }),
          {
            decoder: decode,
            encoder: encode,
          },
        );
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);
        module.register(registry);
        const next = vi.fn(async () => createEnvelope());
        const envelope = createEnvelope({ event: 'ping' });

        const result = await state.onReceive?.(envelope, runtimeContext, next);

        expect(exec).toHaveBeenCalledTimes(1);
        expect(runtimeContext.emitEvent).toHaveBeenCalledWith({
          event: 'ping',
          payload: new Uint8Array([7]),
          metadata: undefined,
          context: undefined,
        });
        expect(result).toBe(envelope);
      });

      it('should execute field operation when field event syntax is received', async () => {
        const decode = vi.fn(() => ({ dependsOn: { id: 'u-1' }, input: { locale: 'en' } }));
        const encode = vi.fn(() => new Uint8Array([5]));
        const dependsOnSchema = createBaseSchemaMock<{ id: string }>({ outputValue: { id: 'u-1' } });
        const inputSchema = createBaseSchemaMock<{ locale: string }>({ outputValue: { locale: 'en' } });
        const outputSchema = createBaseSchemaMock<{ value: string }>({ outputValue: { value: 'Alice' } });
        const exec = vi.fn(async () => ({ value: 'Alice' }));
        const module = schemaModule(
          createSchemaModuleLike({
            fieldOperations: {
              'User.displayName': fieldOperation({
                dependsOn: dependsOnSchema,
                input: inputSchema,
                output: outputSchema,
                exec,
              }) as ModuleFieldOperation,
            },
          }),
          {
            decoder: decode,
            encoder: encode,
          },
        );
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);
        module.register(registry);
        const next = vi.fn(async () => createEnvelope());

        await state.onReceive?.(
          createEnvelope({ event: '$User.displayName' }),
          runtimeContext,
          next,
        );

        expect(exec).toHaveBeenCalledTimes(1);
        expect(runtimeContext.emitEvent).toHaveBeenCalledWith({
          event: '$User.displayName',
          payload: new Uint8Array([5]),
          metadata: undefined,
          context: undefined,
        });
      });
    });

    describe('sad', () => {
      it('should delegate to next when no matching operation or field operation exists', async () => {
        const module = schemaModule(createSchemaModuleLike());
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);
        module.register(registry);
        const nextResult = createEnvelope({ event: 'fallback' });
        const next = vi.fn(async () => nextResult);

        const result = await state.onReceive?.(
          createEnvelope({ event: 'missing.event' }),
          runtimeContext,
          next,
        );

        expect(next).toHaveBeenCalledTimes(1);
        expect(result).toBe(nextResult);
      });

      it('should emit runtime error when operation execution throws', async () => {
        const decode = vi.fn(() => ({ id: 'u-1' }));
        const execError = new Error('operation failed');
        const module = schemaModule(
          createSchemaModuleLike({
            operations: {
              ping: operation({
                input: createBaseSchemaMock<{ id: string }>({ outputValue: { id: 'u-1' } }),
                exec: async () => {
                  throw execError;
                },
              }) as unknown as ModuleOperation,
            },
          }),
          {
            decoder: decode,
          },
        );
        const state: RegistryHookState = {};
        const registry = createRegistryMock(state);
        module.register(registry);
        const next = vi.fn(async () => createEnvelope());
        const envelope = createEnvelope({ event: 'ping' });

        const result = await state.onReceive?.(envelope, runtimeContext, next);

        expect(runtimeContext.emitError).toHaveBeenCalledTimes(1);
        expect(result).toBe(envelope);
      });
    });
  });
});
