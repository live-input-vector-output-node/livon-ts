// Template for generated Livon client module
/*__LIVON_CLIENT_IMPORTS__*/

/*__LIVON_CLIENT_TYPE_DEFS__*/
/*__LIVON_CLIENT_EVENT_MAP__*/
/*__LIVON_CLIENT_FIELD_OPS__*/
/*__LIVON_CLIENT_OP_DEFS__*/

export type SubscriptionName = keyof LivonEventMap;
export type SubscriptionHandler<TName extends SubscriptionName> = (payload: LivonEventMap[TName], ctx: ClientHandlerContext) => void;
/*__LIVON_CLIENT_SUB_HANDLER_DEFS__*/
export interface SubscriptionToggleEntry { on(): void; off(): void; }
export type SubscriptionToggles = { [K in SubscriptionName]: SubscriptionToggleEntry };
export interface RoomApi extends SubscriptionToggles {
  (handlers: SubscriptionHandlers): void;
}
export interface LivonClient extends SubscriptionToggles, ClientModule {
  (handlers: SubscriptionHandlers): void;
  room(roomId: string): RoomApi;
/*__LIVON_CLIENT_OP_LINES__*/
  __register?: (handlers: Record<string, SubscriptionHandler<SubscriptionName>>, roomId?: string) => void;
  __toggle?: (event: SubscriptionName, enabled: boolean, roomId?: string) => void;
}

const subscriptionNames = [/*__LIVON_CLIENT_SUB_NAMES__*/] as const;

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

export const __LIVON_CLIENT_EXPORT_NAME__ = createApi();
export const createApiClient = () => createApi();
