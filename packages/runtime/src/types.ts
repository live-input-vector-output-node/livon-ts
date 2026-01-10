export interface RuntimeEventContext {}

export type EventStatus = 'sending' | 'receiving' | 'failed';

export interface EventError {
  message: string;
  name?: string;
  stack?: string;
  context?: Readonly<RuntimeEventContext>;
}

export interface EventEnvelopeBase {
  id: string;
  event: string;
  status: EventStatus;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
}

export interface EventEnvelopePayload extends EventEnvelopeBase {
  payload: Uint8Array;
  error?: EventError;
}

export interface EventEnvelopeError extends EventEnvelopeBase {
  error: EventError;
  payload?: Uint8Array;
}

export type EventEnvelope = EventEnvelopePayload | EventEnvelopeError;

export interface EmitInputBase {
  id?: string;
  event: string;
  status?: EventStatus;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
}

export interface EmitInputPayload extends EmitInputBase {
  payload: Uint8Array;
  error?: EventError;
}

export interface EmitInputError extends EmitInputBase {
  error: EventError;
  payload?: Uint8Array;
}

export type EmitInput = EmitInputPayload | EmitInputError;

export interface EventAck {
  ok: boolean;
  error?: string;
  metadata?: Readonly<Record<string, unknown>>;
}

export interface EmitEvent {
  (input: EmitInput): Promise<EventAck>;
}

export interface EmitReceive {
  (input: EmitInput): Promise<EventAck>;
}

export interface EmitSend {
  (input: EmitInput): Promise<EventAck>;
}

export interface EmitError {
  (input: EmitInput): Promise<EventAck>;
}

export interface RoomSelector {
  (name: string): RuntimeContext;
}

export interface StateGet {
  <T = unknown>(key: string): T | undefined;
}

export interface StateSet {
  <T = unknown>(key: string, value: T): void;
}

export interface RuntimeState {
  get: StateGet;
  set: StateSet;
}

export interface RuntimeContext {
  emitEvent: EmitEvent;
  emitReceive: EmitReceive;
  emitSend: EmitSend;
  emitError: EmitError;
  room: RoomSelector;
  state: RuntimeState;
}

export interface RuntimeNext {
  (update?: PartialEventEnvelope): Promise<EventEnvelope>;
}

export interface RuntimeHook {
  (envelope: EventEnvelope, ctx: RuntimeContext, next: RuntimeNext): Promise<EventEnvelope> | EventEnvelope;
}

export interface RuntimeModule {
  name: string;
  register: RuntimeModuleRegister;
}

export interface RuntimeOnError {
  (error: unknown, envelope: EventEnvelope, ctx: RuntimeContext): void;
}

export interface RuntimeHookSubscription {
  unsub: RuntimeUnsubscribe;
}

export interface RuntimeUnsubscribe {
  (): void;
}

export interface RuntimeInput {
  modules: readonly RuntimeModule[];
}

export interface RuntimeModuleRegister {
  (registry: RuntimeRegistry): void;
}

export interface RuntimeHookRegister {
  (hook: RuntimeHook): RuntimeHookSubscription;
}

export interface RuntimeOnErrorRegister {
  (hook: RuntimeOnError): RuntimeHookSubscription;
}

export interface RuntimeRegistry {
  emitReceive: EmitReceive;
  emitSend: EmitSend;
  emitError: EmitError;
  onReceive: RuntimeHookRegister;
  onSend: RuntimeHookRegister;
  onError: RuntimeOnErrorRegister;
  state: RuntimeState;
}

export interface PartialEventEnvelopeBase {
  id?: string;
  event?: string;
  status?: EventStatus;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
}

export interface PartialEventEnvelopePayload extends PartialEventEnvelopeBase {
  payload?: Uint8Array;
  error?: EventError;
}

export interface PartialEventEnvelopeError extends PartialEventEnvelopeBase {
  error?: EventError;
  payload?: Uint8Array;
}

export interface PartialEventEnvelopeEmpty extends PartialEventEnvelopeBase {
  payload?: undefined;
  error?: undefined;
}

export type PartialEventEnvelope =
  | PartialEventEnvelopePayload
  | PartialEventEnvelopeError
  | PartialEventEnvelopeEmpty;

export interface RuntimeStart {
  (...modules: RuntimeModule[]): void;
  (input: RuntimeInput): void;
}
