import { vi } from 'vitest';

import type {
  EmitInput,
  EventError,
  EventEnvelope,
  EventStatus,
  RuntimeContext,
  RuntimeEventContext,
  RuntimeHook,
  RuntimeModule,
  RuntimeNext,
  RuntimeRegistry,
} from '../../types.js';

export type RuntimeHookMock = ReturnType<typeof vi.fn<RuntimeHook>>;

export const createRuntimeHookMock = (
  implementation?: RuntimeHook,
): RuntimeHookMock =>
  vi.fn<RuntimeHook>(
    implementation ??
      ((envelope: EventEnvelope, _ctx: RuntimeContext, next: RuntimeNext) => {
        return next({ metadata: { hook: true, ...(envelope.metadata ?? {}) } });
      }),
  );

export interface RuntimeModuleMock extends RuntimeModule {
  register: ReturnType<typeof vi.fn<(registry: RuntimeRegistry) => void>>;
}

export interface RuntimeModuleMockInput {
  name?: string;
  register?: (registry: RuntimeRegistry) => void;
}

export const createRuntimeModuleMock = (
  input: RuntimeModuleMockInput = {},
): RuntimeModuleMock => ({
  name: input.name ?? 'runtime.module.mock',
  register: vi.fn<(registry: RuntimeRegistry) => void>((registry: RuntimeRegistry) => {
    input.register?.(registry);
  }),
});

export interface EmitInputMockOverrides {
  id?: string;
  event?: string;
  status?: EventStatus;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
  payload?: Uint8Array;
  error?: EventError;
}

export const createEmitInputMock = (
  overrides: EmitInputMockOverrides = {},
): EmitInput => ({
  event: overrides.event ?? 'mock.event',
  payload: new Uint8Array([1, 2, 3]),
  ...overrides,
});
