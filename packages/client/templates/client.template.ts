// Template for generated Livon client module
${{LIVON_CLIENT_IMPORTS}}

${{LIVON_CLIENT_TYPE_DEFS}}
${{LIVON_CLIENT_EVENT_MAP}}
${{LIVON_CLIENT_FIELD_OPS}}
${{LIVON_CLIENT_OP_DEFS}}

export type SubscriptionName = keyof LivonEventMap;
export type SubscriptionHandler<TName extends SubscriptionName> = (payload: LivonEventMap[TName], ctx: ClientHandlerContext) => void;
export type SubscriptionHandlers = Partial<{ [K in SubscriptionName]: SubscriptionHandler<K> }>;
export interface SubscriptionToggleEntry { on(): void; off(): void; }
export type SubscriptionToggles = { [K in SubscriptionName]: SubscriptionToggleEntry };
export interface RoomApi extends SubscriptionToggles {
  (handlers: SubscriptionHandlers): void;
}
export interface LivonClient extends SubscriptionToggles, ClientModule {
  (handlers: SubscriptionHandlers): void;
  room(roomId: string): RoomApi;
${{LIVON_CLIENT_OP_LINES}}
  __register?: (handlers: Record<string, SubscriptionHandler<SubscriptionName>>, roomId?: string) => void;
  __toggle?: (event: SubscriptionName, enabled: boolean, roomId?: string) => void;
}

const subscriptionNames = [${{LIVON_CLIENT_SUB_NAMES}}] as const;

const runtimeClient = createRuntimeClient({ ast }) as unknown as LivonClient;

const createApi = (roomId?: string): LivonClient => {
  const call = ((handlers: SubscriptionHandlers) => {
    if (runtimeClient.__register) {
      runtimeClient.__register(handlers as Record<string, SubscriptionHandler<SubscriptionName>>, roomId);
    }
  }) as LivonClient;
  const toggles = subscriptionNames.reduce<Record<string, SubscriptionToggleEntry>>((acc, name) => {
    acc[name] = {
      on: () => runtimeClient.__toggle?.(name as SubscriptionName, true, roomId),
      off: () => runtimeClient.__toggle?.(name as SubscriptionName, false, roomId),
    };
    return acc;
  }, {});
  Object.setPrototypeOf(call, runtimeClient);
  return Object.assign(call, toggles, {
    room: (id: string) => createApi(id),
  });
};

export const ${{LIVON_CLIENT_EXPORT_NAME}} = createApi();
export const createApiClient = () => createApi();
