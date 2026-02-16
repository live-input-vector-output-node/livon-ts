// Template for generated Livon client module
import { createClient as createRuntimeClient } from '@livon/client';
import type { ClientHandlerContext, ClientModule } from '@livon/client';
import { ast } from './ast.js';

/**
 * Type: string (author).
 * @example "string"
 */
export type Author = string;

/**
 * Type: date (createdAt).
 * @example new Date()
 */
export type CreatedAt = Date;

/**
 * Type: string (greeting).
 * @example "string"
 */
export type Greeting = string;

/**
 * Type: object (Hello).
 * Fields: userId.
 * @example { userId: ... }
 */
export interface Hello {
  /**
   * Field: userId.
   * Type: HelloUserId.
   * See {@link HelloUserId}.
   * @example ...
   */
  userId: HelloUserId;
}

/**
 * Type: object (HelloInput).
 * Fields: userId.
 * @example { userId: "string" }
 */
export interface HelloInput {
  /**
   * Field: userId.
   * Type: HelloUserId.
   * See {@link HelloUserId}.
   * @example "string"
   */
  userId: HelloUserId;
}

/**
 * Type: string (helloUserId).
 * @example "string"
 */
export type HelloUserId = string;

/**
 * Type: string (_id).
 * @example "string"
 */
export type Id = string;

/**
 * Type: object (ListUsersInput).
 * @example {  }
 */
export interface ListUsersInput {
}

/**
 * Type: object (Message).
 * Fields: id, author, text, createdAt, roomId.
 * @example { id: "string", author: ..., text: ..., ... }
 */
export interface Message {
  /**
   * Field: id.
   * Type: MessageId.
   * See {@link MessageId}.
   * @example "string"
   */
  id: MessageId;
  /**
   * Field: author.
   * Type: Author.
   * See {@link Author}.
   * @example ...
   */
  author: Author;
  /**
   * Field: text.
   * Type: Text.
   * See {@link Text}.
   * @example ...
   */
  text: Text;
  /**
   * Field: createdAt.
   * Type: CreatedAt.
   * See {@link CreatedAt}.
   * @example new Date()
   */
  createdAt: CreatedAt;
  /**
   * Field: roomId.
   * Type: RoomId.
   * See {@link RoomId}.
   * @example ...
   */
  roomId: RoomId;
}

/**
 * Type: string (messageId).
 * @example "string"
 */
export type MessageId = string;

/**
 * Type: string (name).
 * @example "string"
 */
export type Name = string;

/**
 * Type: string (roomId).
 * @example "string"
 */
export type RoomId = string;

/**
 * Type: object (SendMessageInput).
 * Fields: author, text, roomId.
 * @example { author: "string", text: "string", roomId: "string" }
 */
export interface SendMessageInput {
  /**
   * Field: author.
   * Type: Author.
   * See {@link Author}.
   * @example "string"
   */
  author: Author;
  /**
   * Field: text.
   * Type: Text.
   * See {@link Text}.
   * @example "string"
   */
  text: Text;
  /**
   * Field: roomId.
   * Type: RoomId.
   * See {@link RoomId}.
   * @example "string"
   */
  roomId: RoomId;
}

/**
 * Type: string (text).
 * @example "string"
 */
export type Text = string;

/**
 * Type: object (User).
 * Fields: _id, name.
 * @example { _id: ..., name: "string" }
 */
export interface User {
  /**
   * Field: _id.
   * Type: Id.
   * See {@link Id}.
   * @example ...
   */
  _id: Id;
  /**
   * Field: name.
   * Type: Name.
   * See {@link Name}.
   * @example "string"
   */
  name: Name;
  /**
   * Field operation: User.greeting.
   * Constraints: owner="User", field="greeting", response="greeting", dependsOn="User".
   * Depends on: User.
   * Output type: Greeting.
   * See {@link User}.
   * @returns Greeting field operation result.
   * See {@link Greeting}.
   * @example
   * await greeting()
   * @example
   * greeting(): Greeting
   */
  greeting?: UserGreetingField;
  /**
   * Field operation: User.friends.
   * Constraints: owner="User", field="friends", response="UserList", dependsOn="User".
   * Depends on: User.
   * Output type: UserList.
   * See {@link User}.
   * @returns UserList field operation result.
   * See {@link UserList}.
   * @example
   * await friends()
   * @example
   * friends(): UserList
   */
  friends?: UserFriendsField;
}

/**
 * Type: object (UserInput).
 * Fields: _id.
 * @example { _id: "string" }
 */
export interface UserInput {
  /**
   * Field: _id.
   * Type: Id.
   * See {@link Id}.
   * @example "string"
   */
  _id: Id;
}

/**
 * Type: array (UserList).
 * @example [...]
 */
export type UserList = Array<User>;

export type LivonEventMap = {
  "onUserJoined": User;
  "onUserLeft": User;
  "onHello": Hello;
  "onMessage": Message;
};

/**
 * Field operation: User.friends.
 * Depends on: User.
 * Output type: UserList.
 * See {@link User}.
 * @returns UserList field operation result.
 * See {@link UserList}.
 * @example
 * await friends()
 * @example
 * friends(): UserList
 */
export interface UserFriendsField {
  (): Promise<UserList>;
}

/**
 * Field operation: User.greeting.
 * Depends on: User.
 * Output type: Greeting.
 * See {@link User}.
 * @returns Greeting field operation result.
 * See {@link Greeting}.
 * @example
 * await greeting()
 * @example
 * greeting(): Greeting
 */
export interface UserGreetingField {
  (): Promise<Greeting>;
}

/**
 * Operation: hello.
 * Constraints: publish=["onHello"], request="HelloInput", response="Hello".
 * Output type: Hello.
 * Input type: HelloInput.
 * @param input - HelloInput request payload.
 * See {@link HelloInput}.
 * @returns Hello operation result.
 * See {@link Hello}.
 * Publishes events: onHello.
 * @example
 * await client.hello({ userId: "string" })
 * @example
 * hello({ userId: "string" }: HelloInput): Hello
 */
export interface HelloOperation {
  (input: HelloInput): Promise<Hello>;
}

/**
 * Operation: joinChat.
 * Constraints: publish=["onUserJoined"], request="UserInput", response="User".
 * Output type: User.
 * Input type: UserInput.
 * @param input - UserInput request payload.
 * See {@link UserInput}.
 * @returns User operation result.
 * See {@link User}.
 * Publishes events: onUserJoined.
 * @example
 * await client.joinChat(...)
 * @example
 * joinChat(...: UserInput): User
 */
export interface JoinChatOperation {
  (input: UserInput): Promise<User>;
}

/**
 * Operation: leaveChat.
 * Constraints: publish=["onUserLeft"], request="UserInput", response="User".
 * Output type: User.
 * Input type: UserInput.
 * @param input - UserInput request payload.
 * See {@link UserInput}.
 * @returns User operation result.
 * See {@link User}.
 * Publishes events: onUserLeft.
 * @example
 * await client.leaveChat(...)
 * @example
 * leaveChat(...: UserInput): User
 */
export interface LeaveChatOperation {
  (input: UserInput): Promise<User>;
}

/**
 * Operation: listUsers.
 * Constraints: request="ListUsersInput", response="UserList".
 * Output type: UserList.
 * Input type: ListUsersInput.
 * @param input - ListUsersInput request payload.
 * See {@link ListUsersInput}.
 * @returns UserList operation result.
 * See {@link UserList}.
 * @example
 * await client.listUsers({  })
 * @example
 * listUsers({  }: ListUsersInput): UserList
 */
export interface ListUsersOperation {
  (input: ListUsersInput): Promise<UserList>;
}

/**
 * Operation: sendMessage.
 * Constraints: publish=["onMessage"], ack={"required":true,"mode":"received","timeoutMs":5000,"retries":3}, request="SendMessageInput", response="Message".
 * Output type: Message.
 * Input type: SendMessageInput.
 * @param input - SendMessageInput request payload.
 * See {@link SendMessageInput}.
 * @returns Message operation result.
 * See {@link Message}.
 * Publishes events: onMessage.
 * @example
 * await client.sendMessage({ author: "string", text: "string", roomId: "string" })
 * @example
 * sendMessage({ author: "string", text: "string", roomId: "string" }: SendMessageInput): Message
 */
export interface SendMessageOperation {
  (input: SendMessageInput): Promise<Message>;
}

/**
 * Operation: user.
 * Constraints: request="UserInput", response="User".
 * Output type: User.
 * Input type: UserInput.
 * @param input - UserInput request payload.
 * See {@link UserInput}.
 * @returns User operation result.
 * See {@link User}.
 * @example
 * await client.user({ _id: "string" })
 * @example
 * user({ _id: "string" }: UserInput): User
 */
export interface UserOperation {
  (input: UserInput): Promise<User>;
}


export type SubscriptionName = keyof LivonEventMap;
export type SubscriptionHandler<TName extends SubscriptionName> = (payload: LivonEventMap[TName], ctx: ClientHandlerContext) => void;
/**
 * Subscription handler for "onHello".
 * Constraints: input="HelloInput", payload="Hello", output="Hello".
 * Request input: HelloInput.
 * Output type: Hello.
 * @param payload - Hello payload emitted for "onHello".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link Hello} and {@link ClientHandlerContext}.
 * @example
 * api({ onHello: (payload) => payload });
 */
export interface OnHelloSubscription {
  (payload: Hello, ctx: ClientHandlerContext): void;
}

/**
 * Subscription handler for "onMessage".
 * Constraints: input="SendMessageInput", payload="Message", output="Message".
 * Request input: SendMessageInput.
 * Output type: Message.
 * @param payload - Message payload emitted for "onMessage".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link Message} and {@link ClientHandlerContext}.
 * @example
 * api({ onMessage: (payload) => payload });
 */
export interface OnMessageSubscription {
  (payload: Message, ctx: ClientHandlerContext): void;
}

/**
 * Subscription handler for "onUserJoined".
 * Constraints: input="UserInput", payload="User", output="User".
 * Request input: UserInput.
 * Output type: User.
 * @param payload - User payload emitted for "onUserJoined".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link User} and {@link ClientHandlerContext}.
 * @example
 * api({ onUserJoined: (payload) => payload });
 */
export interface OnUserJoinedSubscription {
  (payload: User, ctx: ClientHandlerContext): void;
}

/**
 * Subscription handler for "onUserLeft".
 * Constraints: input="UserInput", payload="User", output="User".
 * Request input: UserInput.
 * Output type: User.
 * @param payload - User payload emitted for "onUserLeft".
 * @param ctx - ClientHandlerContext runtime metadata and room context.
 * See {@link User} and {@link ClientHandlerContext}.
 * @example
 * api({ onUserLeft: (payload) => payload });
 */
export interface OnUserLeftSubscription {
  (payload: User, ctx: ClientHandlerContext): void;
}

export interface SubscriptionHandlers {
  /**
   * Subscription callback for "onHello".
   * Constraints: input="HelloInput", payload="Hello", output="Hello".
   * Request input: HelloInput.
   * Output type: Hello.
   * @param payload - Hello payload emitted for "onHello".
   * @param ctx - ClientHandlerContext runtime metadata and room context.
   * See {@link Hello} and {@link ClientHandlerContext}.
   * @example
   * api({ onHello: (payload) => payload });
   */
  onHello?(payload: Hello, ctx: ClientHandlerContext): void;
  /**
   * Subscription callback for "onMessage".
   * Constraints: input="SendMessageInput", payload="Message", output="Message".
   * Request input: SendMessageInput.
   * Output type: Message.
   * @param payload - Message payload emitted for "onMessage".
   * @param ctx - ClientHandlerContext runtime metadata and room context.
   * See {@link Message} and {@link ClientHandlerContext}.
   * @example
   * api({ onMessage: (payload) => payload });
   */
  onMessage?(payload: Message, ctx: ClientHandlerContext): void;
  /**
   * Subscription callback for "onUserJoined".
   * Constraints: input="UserInput", payload="User", output="User".
   * Request input: UserInput.
   * Output type: User.
   * @param payload - User payload emitted for "onUserJoined".
   * @param ctx - ClientHandlerContext runtime metadata and room context.
   * See {@link User} and {@link ClientHandlerContext}.
   * @example
   * api({ onUserJoined: (payload) => payload });
   */
  onUserJoined?(payload: User, ctx: ClientHandlerContext): void;
  /**
   * Subscription callback for "onUserLeft".
   * Constraints: input="UserInput", payload="User", output="User".
   * Request input: UserInput.
   * Output type: User.
   * @param payload - User payload emitted for "onUserLeft".
   * @param ctx - ClientHandlerContext runtime metadata and room context.
   * See {@link User} and {@link ClientHandlerContext}.
   * @example
   * api({ onUserLeft: (payload) => payload });
   */
  onUserLeft?(payload: User, ctx: ClientHandlerContext): void;
}

export interface SubscriptionToggleEntry { on(): void; off(): void; }
export type SubscriptionToggles = { [K in SubscriptionName]: SubscriptionToggleEntry };
export interface RoomApi extends SubscriptionToggles {
  (handlers: SubscriptionHandlers): void;
}
export interface LivonClient extends SubscriptionToggles, ClientModule {
  (handlers: SubscriptionHandlers): void;
  room(roomId: string): RoomApi;
  /**
   * Operation: hello.
   * Constraints: publish=["onHello"], request="HelloInput", response="Hello".
   * Output type: Hello.
   * Input type: HelloInput.
   * @param input - HelloInput request payload.
   * See {@link HelloInput}.
   * @returns Hello operation result.
   * See {@link Hello}.
   * Publishes events: onHello.
   * @example
   * await client.hello({ userId: "string" })
   * @example
   * hello({ userId: "string" }: HelloInput): Hello
   */
  hello(input: HelloInput): Promise<Hello>;
  /**
   * Operation: joinChat.
   * Constraints: publish=["onUserJoined"], request="UserInput", response="User".
   * Output type: User.
   * Input type: UserInput.
   * @param input - UserInput request payload.
   * See {@link UserInput}.
   * @returns User operation result.
   * See {@link User}.
   * Publishes events: onUserJoined.
   * @example
   * await client.joinChat(...)
   * @example
   * joinChat(...: UserInput): User
   */
  joinChat(input: UserInput): Promise<User>;
  /**
   * Operation: leaveChat.
   * Constraints: publish=["onUserLeft"], request="UserInput", response="User".
   * Output type: User.
   * Input type: UserInput.
   * @param input - UserInput request payload.
   * See {@link UserInput}.
   * @returns User operation result.
   * See {@link User}.
   * Publishes events: onUserLeft.
   * @example
   * await client.leaveChat(...)
   * @example
   * leaveChat(...: UserInput): User
   */
  leaveChat(input: UserInput): Promise<User>;
  /**
   * Operation: listUsers.
   * Constraints: request="ListUsersInput", response="UserList".
   * Output type: UserList.
   * Input type: ListUsersInput.
   * @param input - ListUsersInput request payload.
   * See {@link ListUsersInput}.
   * @returns UserList operation result.
   * See {@link UserList}.
   * @example
   * await client.listUsers({  })
   * @example
   * listUsers({  }: ListUsersInput): UserList
   */
  listUsers(input: ListUsersInput): Promise<UserList>;
  /**
   * Operation: sendMessage.
   * Constraints: publish=["onMessage"], ack={"required":true,"mode":"received","timeoutMs":5000,"retries":3}, request="SendMessageInput", response="Message".
   * Output type: Message.
   * Input type: SendMessageInput.
   * @param input - SendMessageInput request payload.
   * See {@link SendMessageInput}.
   * @returns Message operation result.
   * See {@link Message}.
   * Publishes events: onMessage.
   * @example
   * await client.sendMessage({ author: "string", text: "string", roomId: "string" })
   * @example
   * sendMessage({ author: "string", text: "string", roomId: "string" }: SendMessageInput): Message
   */
  sendMessage(input: SendMessageInput): Promise<Message>;
  /**
   * Operation: user.
   * Constraints: request="UserInput", response="User".
   * Output type: User.
   * Input type: UserInput.
   * @param input - UserInput request payload.
   * See {@link UserInput}.
   * @returns User operation result.
   * See {@link User}.
   * @example
   * await client.user({ _id: "string" })
   * @example
   * user({ _id: "string" }: UserInput): User
   */
  user(input: UserInput): Promise<User>;
  __register?: (handlers: Record<string, SubscriptionHandler<SubscriptionName>>, roomId?: string) => void;
  __toggle?: (event: SubscriptionName, enabled: boolean, roomId?: string) => void;
}

const subscriptionNames = ["onUserJoined", "onUserLeft", "onHello", "onMessage"] as const;

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

export const api = createApi();
export const createApiClient = () => createApi();
