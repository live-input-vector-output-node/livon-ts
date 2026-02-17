import type {
  EventEnvelope,
  EventStatus,
  RuntimeEventContext,
  RuntimeModule,
  RuntimeModuleRegister,
  RuntimeRegistry,
} from '@livon/runtime';

export interface AstNode {
  type: string;
  name?: string;
  doc?: Readonly<Record<string, unknown>>;
  request?: string;
  response?: string;
  dependsOn?: string;
  constraints?: Readonly<Record<string, unknown>>;
  children?: readonly AstNode[];
}

export interface ClientRequest {
  (event: string, payload: unknown): Promise<unknown>;
}

export interface ClientTransportConnect {
  (): Promise<void>;
}

export interface ClientTransportClose {
  (): void;
}

export interface ClientOptions {
  ast: AstNode;
}

export interface ClientModuleInput {
  ast: AstNode;
  name?: string;
  requestKey?: string;
}

export interface ClientModule extends RuntimeModule {}

export interface ClientHandlerContext {
  eventId: string;
  event: string;
  status: EventStatus;
  room?: string;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
}

export interface ClientSubscriptionHandler {
  (payload: unknown, ctx: ClientHandlerContext): void;
}

export interface ClientEventEnvelope {
  id: string;
  event: string;
  status: EventStatus;
  payload?: unknown;
  error?: unknown;
  metadata?: Readonly<Record<string, unknown>>;
  context?: RuntimeEventContext;
}

export interface ClientEventEmitter {
  emitEvent: (envelope: ClientEventEnvelope) => void;
}

export interface ClientRequestSetter {
  setRequest: (request: ClientRequest) => void;
}

export interface ClientModuleOptions {
  name?: string;
  requestKey?: string;
}

const DEFAULT_REQUEST_KEY = 'livon.client.request';

interface SetClientRequestInput {
  client: unknown;
  registry: RuntimeRegistry;
  requestKey: string;
}

const setClientRequest = ({ client, registry, requestKey }: SetClientRequestInput) => {
  if (typeof client !== 'object' || client === null || !('setRequest' in client)) {
    return;
  }
  const candidate = client as ClientRequestSetter;
  if (typeof candidate.setRequest !== 'function') {
    return;
  }
  candidate.setRequest((event, payload) => {
    const request = registry.state.get<ClientRequest>(requestKey);
    if (!request) {
      throw new Error('Client request handler is not available.');
    }
    return request(event, payload);
  });
};

const buildClientEventEnvelope = (envelope: EventEnvelope): ClientEventEnvelope => {
  if ('payload' in envelope) {
    return {
      ...envelope,
      payload: envelope.payload as unknown,
    };
  }
  return {
    ...envelope,
    error: envelope.error,
  };
};

/**
 * clientModule is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/client
 *
 * @example
 * const result = clientModule(undefined as never);
 */
export const clientModule = (client: ClientEventEmitter, options: ClientModuleOptions = {}): RuntimeModule => {
  const register: RuntimeModuleRegister = (registry) => {
    const requestKey = options.requestKey ?? DEFAULT_REQUEST_KEY;
    setClientRequest({ client, registry, requestKey });
    registry.onReceive((envelope, _ctx, next) => {
      client.emitEvent(buildClientEventEnvelope(envelope));
      return next();
    });
  };

  return {
    name: options.name ?? 'client-module',
    register,
  };
};

interface OperationSpec {
  name: string;
  input?: AstNode;
  output?: AstNode;
  event: string;
}

interface FieldSpec {
  owner: string;
  field: string;
  input?: AstNode;
  output?: AstNode;
  event: string;
}

type FieldRegistry = Map<string, Map<string, FieldSpec>>;

interface FieldPayload {
  dependsOn: unknown;
  input?: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isArray = (value: unknown): value is unknown[] => Array.isArray(value);

const capitalize = (value: string): string =>
  value.length === 0 ? value : value.slice(0, 1).toUpperCase() + value.slice(1);

const camelCaseName = (value: string): string => {
  if (!value) return value;
  return value
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, group) => String(group).toUpperCase())
    .replace(/^./, (char) => char.toLowerCase());
};

const fieldMethodName = (owner: string, field: string) => `$${camelCaseName(owner)}${capitalize(field)}`;

const fieldEventName = (owner: string, field: string) => `$${owner}.${field}`;

const walkAst = (node: AstNode, visit: (node: AstNode) => void) => {
  visit(node);
  node.children?.forEach((child) => walkAst(child, visit));
};

const collectOperations = (root: AstNode): OperationSpec[] => {
  const operations: OperationSpec[] = [];
  walkAst(root, (node) => {
    if (node.type !== 'operation' || !node.name) {
      return;
    }
    const input = node.children?.[0];
    const output = node.children?.[1];
    operations.push({
      name: node.name,
      input,
      output,
      event: node.name,
    });
  });
  return operations;
};

const collectFieldOperations = (root: AstNode): FieldRegistry => {
  const registry: FieldRegistry = new Map();
  walkAst(root, (node) => {
    if (node.type !== 'field') {
      return;
    }
    const constraints = node.constraints;
    const owner = typeof constraints?.owner === 'string' ? constraints.owner : undefined;
    const field = typeof constraints?.field === 'string' ? constraints.field : undefined;
    if (!owner || !field) {
      return;
    }
    const children = node.children ?? [];
    const dependsOn = children[0];
    const input = children.length === 3 ? children[1] : undefined;
    const output = children.length === 3 ? children[2] : children[1];
    if (!dependsOn) {
      return;
    }
    const spec: FieldSpec = {
      owner,
      field,
      input,
      output,
      event: fieldEventName(owner, field),
    };
    if (!registry.has(owner)) {
      registry.set(owner, new Map());
    }
    registry.get(owner)!.set(field, spec);
  });
  return registry;
};

interface HydrateByNodeInput {
  value: unknown;
  node: AstNode | undefined;
  registry: FieldRegistry;
  request: ClientRequest;
}

const hydrateByNode = ({ value, node, registry, request }: HydrateByNodeInput): unknown => {
  if (!node) {
    return value;
  }

  if (node.type === 'array' && isArray(value)) {
    const child = node.children?.[0];
    value.forEach((item, index) => {
      value[index] = hydrateByNode({ value: item, node: child, registry, request });
    });
    return value;
  }

  if (node.type === 'tuple' && isArray(value)) {
    const children = node.children ?? [];
    value.forEach((item, index) => {
      value[index] = hydrateByNode({ value: item, node: children[index], registry, request });
    });
    return value;
  }

  if (node.type === 'and') {
    return (node.children ?? []).reduce(
      (current, child) => hydrateByNode({ value: current, node: child, registry, request }),
      value,
    );
  }

  if (node.type === 'object' && isRecord(value)) {
    const typeName = node.name;
    if (typeName && registry.has(typeName)) {
      attachFieldOperations({ target: value, typeName, registry, request });
    }
    const fields = node.children ?? [];
    fields.forEach((fieldNode) => {
      if (fieldNode.type !== 'field' || !fieldNode.name) {
        return;
      }
      const child = fieldNode.children?.[0];
      if (!child) {
        return;
      }
      value[fieldNode.name] = hydrateByNode({
        value: value[fieldNode.name],
        node: child,
        registry,
        request,
      });
    });
    return value;
  }

  if (node.type === 'field') {
    const child = node.children?.[0];
    return hydrateByNode({ value, node: child, registry, request });
  }

  return value;
};

interface AttachFieldOperationsInput {
  target: Record<string, unknown>;
  typeName: string;
  registry: FieldRegistry;
  request: ClientRequest;
}

const attachFieldOperations = ({ target, typeName, registry, request }: AttachFieldOperationsInput) => {
  const operations = registry.get(typeName);
  if (!operations) {
    return;
  }
  if (!Object.isExtensible(target)) {
    return;
  }

  operations.forEach((spec, fieldName) => {
    if (fieldName in target) {
      return;
    }
    Object.defineProperty(target, fieldName, {
      enumerable: false,
      configurable: true,
      value: async (input?: unknown) => {
        const payload = { dependsOn: target, input };
        const result = await request(spec.event, payload);
        return hydrateByNode({ value: result, node: spec.output, registry, request });
      },
    });
  });
};

const normalizeFieldPayload = (payload: unknown): FieldPayload => {
  if (isRecord(payload) && 'dependsOn' in payload) {
    const dependsOn = payload.dependsOn;
    const input = 'input' in payload ? payload.input : undefined;
    if (input === undefined) {
      return { dependsOn };
    }
    return { dependsOn, input };
  }
  return { dependsOn: payload };
};

const createClientCore = ({ ast }: ClientOptions): ClientRequestSetter & Record<string, unknown> & {
  __register?: (handlers: Record<string, ClientSubscriptionHandler>, roomId?: string) => void;
  __toggle?: (event: string, enabled: boolean, roomId?: string) => void;
  emitEvent: (envelope: ClientEventEnvelope) => void;
} => {
  const operations = collectOperations(ast);
  const fieldRegistry = collectFieldOperations(ast);
  let request: ClientRequest | undefined;

  const client: Record<string, unknown> = {};
  client.setRequest = (next: ClientRequest) => {
    request = next;
  };

  const globalHandlers = new Map<string, ClientSubscriptionHandler>();
  const globalEnabled = new Map<string, boolean>();
  const roomHandlers = new Map<string, Map<string, ClientSubscriptionHandler>>();
  const roomEnabled = new Map<string, Map<string, boolean>>();

  const registerHandlers = (
    handlers: Record<string, ClientSubscriptionHandler>,
    roomId?: string,
  ) => {
    const entries = Object.entries(handlers).filter(([, handler]) => typeof handler === 'function');
    if (entries.length === 0) {
      return;
    }
    if (!roomId) {
      entries.forEach(([event, handler]) => {
        globalHandlers.set(event, handler);
        globalEnabled.set(event, true);
      });
      return;
    }
    const roomMap = roomHandlers.get(roomId) ?? new Map<string, ClientSubscriptionHandler>();
    const enabledMap = roomEnabled.get(roomId) ?? new Map<string, boolean>();
    entries.forEach(([event, handler]) => {
      roomMap.set(event, handler);
      enabledMap.set(event, true);
    });
    roomHandlers.set(roomId, roomMap);
    roomEnabled.set(roomId, enabledMap);
  };

  interface ToggleHandlerInput {
    event: string;
    enabled: boolean;
    roomId?: string;
  }

  const toggleHandler = ({ enabled, event, roomId }: ToggleHandlerInput) => {
    if (!roomId) {
      globalEnabled.set(event, enabled);
      return;
    }
    const enabledMap = roomEnabled.get(roomId) ?? new Map<string, boolean>();
    enabledMap.set(event, enabled);
    roomEnabled.set(roomId, enabledMap);
  };

  const dispatch = (envelope: ClientEventEnvelope) => {
    const ctx: ClientHandlerContext = {
      eventId: envelope.id,
      event: envelope.event,
      status: envelope.status,
      metadata: envelope.metadata,
      context: envelope.context,
      room: typeof envelope.metadata?.room === 'string' ? String(envelope.metadata.room) : undefined,
    };
    const roomId = ctx.room;

    if (roomId) {
      const enabledMap = roomEnabled.get(roomId);
      const roomMap = roomHandlers.get(roomId);
      const handler = roomMap?.get(envelope.event);
      const isEnabled = enabledMap?.get(envelope.event) ?? true;
      if (handler && isEnabled) {
        handler(envelope.payload, ctx);
      }
    }

    const handler = globalHandlers.get(envelope.event);
    const isEnabled = globalEnabled.get(envelope.event) ?? true;
    if (handler && isEnabled) {
      handler(envelope.payload, ctx);
    }
  };

  operations.forEach((op) => {
    client[op.name] = async (input?: unknown) => {
      if (!request) {
        throw new Error('Client request handler is not available.');
      }
      const result = await request(op.event, input);
      return hydrateByNode({ value: result, node: op.output, registry: fieldRegistry, request });
    };
  });

  fieldRegistry.forEach((fields, owner) => {
    fields.forEach((spec, field) => {
      const method = fieldMethodName(owner, field);
      if (method in client) {
        return;
      }
      client[method] = async (payload?: unknown, input?: unknown) => {
        const normalized = normalizeFieldPayload(payload);
        if (!request) {
          throw new Error('Client request handler is not available.');
        }
        const result = await request(spec.event, {
          dependsOn: normalized.dependsOn,
          input: input ?? normalized.input,
        });
        return hydrateByNode({ value: result, node: spec.output, registry: fieldRegistry, request });
      };
    });
  });

  return Object.assign(client, {
    __register: registerHandlers,
    __toggle: (event: string, enabled: boolean, roomId?: string) => toggleHandler({ event, enabled, roomId }),
    emitEvent: dispatch,
  }) as ClientRequestSetter & Record<string, unknown> & {
    __register: (handlers: Record<string, ClientSubscriptionHandler>, roomId?: string) => void;
    __toggle: (event: string, enabled: boolean, roomId?: string) => void;
    emitEvent: (envelope: ClientEventEnvelope) => void;
  };
};

/**
 * createClient is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/client
 *
 * @example
 * const result = createClient(undefined as never);
 */
export const createClient = (input: ClientModuleInput): ClientModule & Record<string, unknown> & {
  __register: (handlers: Record<string, ClientSubscriptionHandler>, roomId?: string) => void;
  __toggle: (event: string, enabled: boolean, roomId?: string) => void;
  emitEvent: (envelope: ClientEventEnvelope) => void;
} => {
  const client = createClientCore({ ast: input.ast });
  const register: RuntimeModuleRegister = (registry) => {
    const requestKey = input.requestKey ?? DEFAULT_REQUEST_KEY;
    setClientRequest({ client, registry, requestKey });
    registry.onReceive((envelope, _ctx, next) => {
      client.emitEvent(buildClientEventEnvelope(envelope));
      return next();
    });
  };
  const moduleBase: RuntimeModule = {
    name: input.name ?? 'client',
    register,
  };
  const moduleWithClient = Object.assign(moduleBase, client) as ClientModule & Record<string, unknown> & {
    __register: (handlers: Record<string, ClientSubscriptionHandler>, roomId?: string) => void;
    __toggle: (event: string, enabled: boolean, roomId?: string) => void;
    emitEvent: (envelope: ClientEventEnvelope) => void;
  };
  return moduleWithClient;
};

/**
 * createClientModule is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/packages/client
 *
 * @example
 * const result = createClientModule(undefined as never);
 */
export const createClientModule = (input: ClientModuleInput): ClientModule & Record<string, unknown> =>
  createClient(input);
