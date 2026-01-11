import type {
  EmitInput,
  EventStatus,
  EventError,
  EventAck,
  EventEnvelope,
  RuntimeEventContext,
  RuntimeContext,
  RuntimeHook,
  RuntimeModule,
  RuntimeInput,
  RuntimeHookRegister,
  RuntimeOnError,
  RuntimeOnErrorRegister,
  RuntimeRegistry,
  RuntimeStart,
  RuntimeNext,
  PartialEventEnvelope,
} from './types.js';

interface RuntimeHookStore {
  onReceive: RuntimeHook[];
  onSend: RuntimeHook[];
  onError: RuntimeOnError[];
}

const createHookStore = (): RuntimeHookStore => ({
  onReceive: [],
  onSend: [],
  onError: [],
});

interface RuntimeEventContextRecord extends RuntimeEventContext, Record<string, unknown> {}

interface ErrorLike {
  message?: unknown;
  name?: unknown;
  stack?: unknown;
  context?: unknown;
}

interface GlobalCryptoLike {
  crypto?: {
    randomUUID?: () => string;
  };
}

const createState = () => {
  const store = new Map<string, unknown>();

  const get = <T = unknown>(key: string) => store.get(key) as T | undefined;

  const set = <T = unknown>(key: string, value: T) => {
    store.set(key, value);
  };

  return { get, set };
};

const mergeMetadata = (
  base?: Readonly<Record<string, unknown>>,
  extra?: Readonly<Record<string, unknown>>,
) => {
  if (!base && !extra) {
    return undefined;
  }
  return { ...(base ?? {}), ...(extra ?? {}) };
};

let fallbackEventIdCounter = 0;

const createEventId = () => {
  const cryptoValue = (globalThis as GlobalCryptoLike).crypto;
  if (cryptoValue?.randomUUID) {
    return cryptoValue.randomUUID();
  }
  fallbackEventIdCounter = fallbackEventIdCounter + 1;
  return `evt_${Date.now().toString(36)}_${fallbackEventIdCounter.toString(36)}`;
};

const isContextRecord = (value: unknown): value is RuntimeEventContextRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const contextRecordFrom = (value?: RuntimeEventContext): RuntimeEventContextRecord | undefined => {
  if (!value || !isContextRecord(value)) {
    return undefined;
  }
  return value;
};

const errorFromUnknown = (error: unknown): EventError => {
  if (error instanceof Error) {
    const context = isContextRecord((error as ErrorLike).context)
      ? ((error as ErrorLike).context as RuntimeEventContextRecord)
      : undefined;
    return {
      message: error.message,
      ...(error.name ? { name: error.name } : {}),
      ...(error.stack ? { stack: error.stack } : {}),
      ...(context ? { context } : {}),
    };
  }
  if (typeof error === 'string') {
    return { message: error };
  }
  if (typeof error === 'object' && error !== null) {
    const value = error as ErrorLike;
    const message = typeof value.message === 'string' ? value.message : 'Unknown error';
    const name = typeof value.name === 'string' ? value.name : undefined;
    const stack = typeof value.stack === 'string' ? value.stack : undefined;
    const context = isContextRecord(value.context) ? value.context : undefined;
    return {
      message,
      ...(name ? { name } : {}),
      ...(stack ? { stack } : {}),
      ...(context ? { context } : {}),
    };
  }
  return { message: 'Unknown error' };
};

const registerHook = (hooks: RuntimeHook[]): RuntimeHookRegister => (hook) => {
  hooks.push(hook);
  const unsub = () => {
    const index = hooks.indexOf(hook);
    if (index >= 0) {
      hooks.splice(index, 1);
    }
  };
  return { unsub };
};

const registerErrorHook = (hooks: RuntimeOnError[]): RuntimeOnErrorRegister => (hook) => {
  hooks.push(hook);
  const unsub = () => {
    const index = hooks.indexOf(hook);
    if (index >= 0) {
      hooks.splice(index, 1);
    }
  };
  return { unsub };
};

interface EmitErrorHooksInput {
  runtimeError: unknown;
  eventEnvelope: EventEnvelope;
  runtimeContext: RuntimeContext;
}

interface BuildEnvelopeInput {
  emitInput: EmitInput;
  fallbackStatus: EventStatus;
  roomName?: string;
}

interface BuildFailedEnvelopeInput {
  runtimeError: unknown;
  eventEnvelope: EventEnvelope;
}

interface CreateEmitInput {
  runtimeContext: RuntimeContext;
  roomName?: string;
}

/**
 * runtime is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/packages/runtime
 *
 * @example
 * const result = runtime(undefined as never);
 */
export const runtime: RuntimeStart = (inputOrModule: RuntimeInput | RuntimeModule, ...rest: RuntimeModule[]) => {
  const input: RuntimeInput =
    'modules' in inputOrModule ? inputOrModule : { modules: [inputOrModule, ...rest] };

  const modules = input.modules;
  const state = createState();
  const hooks = createHookStore();

  const onReceive = registerHook(hooks.onReceive);
  const onSend = registerHook(hooks.onSend);
  const onError = registerErrorHook(hooks.onError);

  const emitErrorHooks = ({ runtimeError, eventEnvelope, runtimeContext }: EmitErrorHooksInput) => {
    hooks.onError.forEach((handler) => {
      try {
        handler(runtimeError, eventEnvelope, runtimeContext);
      } catch {
        // ignore secondary errors
      }
    });
  };

  const mergeContext = (
    base?: RuntimeEventContext,
    update?: RuntimeEventContext,
  ): RuntimeEventContext | undefined => {
    const left = contextRecordFrom(base);
    const right = contextRecordFrom(update);
    if (!left && !right) {
      return undefined;
    }
    return { ...(left ?? {}), ...(right ?? {}) };
  };

  const payloadFromEvent = (event: PartialEventEnvelope | EventEnvelope): Uint8Array | undefined => event.payload;

  const errorFromEvent = (event: PartialEventEnvelope | EventEnvelope): EventError | undefined => event.error;

  const mergeEvent = (base: EventEnvelope, update?: PartialEventEnvelope): EventEnvelope => {
    if (!update) {
      return base;
    }
    const nextId = update.id ?? base.id;
    const nextEvent = update.event ?? base.event;
    const nextStatus = update.status ?? base.status;
    const nextMetadata = mergeMetadata(base.metadata, update.metadata);
    const nextContext = mergeContext(base.context, update.context);
    const nextPayload = payloadFromEvent(update) ?? payloadFromEvent(base);
    const nextError = errorFromEvent(update) ?? errorFromEvent(base);
    if (nextPayload === undefined && nextError === undefined) {
      throw new Error('Event envelope must contain payload or error.');
    }
    const mergedEnvelopeBase = {
      ...base,
      id: nextId,
      event: nextEvent,
      status: nextStatus,
      metadata: nextMetadata,
      context: nextContext,
    };
    if (nextPayload !== undefined && nextError !== undefined) {
      return {
        ...mergedEnvelopeBase,
        payload: nextPayload,
        error: nextError,
      };
    }
    if (nextPayload !== undefined) {
      return {
        ...mergedEnvelopeBase,
        payload: nextPayload,
      };
    }
    const definedError = nextError as EventError;
    return {
      ...mergedEnvelopeBase,
      error: definedError,
    };
  };

  const buildEnvelope = ({ emitInput, fallbackStatus, roomName }: BuildEnvelopeInput): EventEnvelope => {
    const { id: inputId, event, status: inputStatus, metadata: inputMetadata, context, payload, error } = emitInput;
    const roomMeta = roomName ? { room: roomName } : undefined;
    const metadata = mergeMetadata(roomMeta, inputMetadata);
    const id = inputId ?? createEventId();
    const status = inputStatus ?? fallbackStatus;
    if (payload === undefined && error === undefined) {
      throw new Error('Emit input must contain payload or error.');
    }
    const envelopeBase = {
      id,
      event,
      status,
      metadata,
      context,
    };
    if (payload !== undefined && error !== undefined) {
      return {
        ...envelopeBase,
        payload,
        error,
      };
    }
    if (payload !== undefined) {
      return {
        ...envelopeBase,
        payload,
      };
    }
    const definedError = error as EventError;
    return {
      ...envelopeBase,
      error: definedError,
    };
  };

  const buildFailedEnvelope = ({ runtimeError, eventEnvelope }: BuildFailedEnvelopeInput): EventEnvelope & { error: EventError } => {
    const normalizedError = errorFromUnknown(runtimeError);
    const nextContext = mergeContext(eventEnvelope.context, normalizedError.context);
    return {
      ...eventEnvelope,
      error: normalizedError,
      context: nextContext,
    };
  };

  interface InvokeHookInput {
    hookChain: readonly RuntimeHook[];
    hookIndex: number;
    eventEnvelope: EventEnvelope;
    runtimeContext: RuntimeContext;
  }

  const invokeHook = (input: InvokeHookInput): Promise<EventEnvelope> => {
    const hook = input.hookChain[input.hookIndex];
    if (!hook) {
      return Promise.resolve(input.eventEnvelope);
    }
    let nextPromise: Promise<EventEnvelope> | undefined;
    let nextCalled = false;
    const next: RuntimeNext = (update) => {
      nextCalled = true;
      nextPromise = invokeHook({
        hookChain: input.hookChain,
        hookIndex: input.hookIndex + 1,
        eventEnvelope: mergeEvent(input.eventEnvelope, update),
        runtimeContext: input.runtimeContext,
      });
      return nextPromise;
    };

    const result = hook(input.eventEnvelope, input.runtimeContext, next);
    if (result === undefined && nextCalled) {
      return nextPromise ?? Promise.resolve(input.eventEnvelope);
    }
    return Promise.resolve(result).then((value) => value ?? nextPromise ?? input.eventEnvelope);
  };

  const runReceive = (eventEnvelope: EventEnvelope, runtimeContext: RuntimeContext) =>
    invokeHook({ hookChain: hooks.onReceive, hookIndex: 0, eventEnvelope, runtimeContext });

  const runSend = (eventEnvelope: EventEnvelope, runtimeContext: RuntimeContext) =>
    invokeHook({ hookChain: hooks.onSend, hookIndex: 0, eventEnvelope, runtimeContext });

  const createEmitError = ({ runtimeContext, roomName }: CreateEmitInput) => async (emitInput: EmitInput): Promise<EventAck> => {
    const envelope = buildEnvelope({ emitInput, fallbackStatus: 'sending', roomName });
    const fallbackError = envelope.error ?? { message: 'Unknown error' };
    const failedEnvelope: EventEnvelope = { ...envelope, error: fallbackError };
    emitErrorHooks({
      runtimeError: fallbackError,
      eventEnvelope: failedEnvelope,
      runtimeContext,
    });
    return { ok: true };
  };

  const createEmitReceive = ({ runtimeContext, roomName }: CreateEmitInput) => async (emitInput: EmitInput): Promise<EventAck> => {
    const envelope = buildEnvelope({ emitInput, fallbackStatus: 'receiving', roomName });
    try {
      await runReceive(envelope, runtimeContext);
      return { ok: true };
    } catch (error) {
      const failedEnvelope = buildFailedEnvelope({ runtimeError: error, eventEnvelope: envelope });
      emitErrorHooks({
        runtimeError: error,
        eventEnvelope: failedEnvelope,
        runtimeContext,
      });
      return { ok: false, error: failedEnvelope.error.message };
    }
  };

  const createEmitSend = ({ runtimeContext, roomName }: CreateEmitInput) => async (emitInput: EmitInput): Promise<EventAck> => {
    const envelope = buildEnvelope({ emitInput, fallbackStatus: 'sending', roomName });
    try {
      await runSend(envelope, runtimeContext);
      return { ok: true };
    } catch (error) {
      const failedEnvelope = buildFailedEnvelope({ runtimeError: error, eventEnvelope: envelope });
      emitErrorHooks({
        runtimeError: error,
        eventEnvelope: failedEnvelope,
        runtimeContext,
      });
      return { ok: false, error: failedEnvelope.error.message };
    }
  };

  const createEmitEvent = (input: CreateEmitInput) => async (eventInput: EmitInput): Promise<EventAck> =>
    createEmitSend(input)(eventInput);

  const createContext = (roomName?: string): RuntimeContext => {
    const runtimeContext = {} as RuntimeContext;
    const createEmitInput = { runtimeContext, roomName };
    runtimeContext.emitReceive = createEmitReceive(createEmitInput);
    runtimeContext.emitSend = createEmitSend(createEmitInput);
    runtimeContext.emitError = createEmitError(createEmitInput);
    runtimeContext.emitEvent = createEmitEvent(createEmitInput);
    runtimeContext.room = (nextRoomName) => createContext(nextRoomName);
    runtimeContext.state = state;
    return runtimeContext;
  };

  const baseContext = createContext();

  const registry: RuntimeRegistry = {
    emitReceive: baseContext.emitReceive,
    emitSend: baseContext.emitSend,
    emitError: baseContext.emitError,
    onReceive,
    onSend,
    onError,
    state,
  };

  modules.forEach((mod) => {
    mod.register(registry);
  });
};
