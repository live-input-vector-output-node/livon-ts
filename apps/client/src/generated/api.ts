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
   * @link HelloUserId
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
   * @link HelloUserId
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
   * @link MessageId
   * @example "string"
   */
  id: MessageId;
  /**
   * Field: author.
   * Type: Author.
   * @link Author
   * @example ...
   */
  author: Author;
  /**
   * Field: text.
   * Type: Text.
   * @link Text
   * @example ...
   */
  text: Text;
  /**
   * Field: createdAt.
   * Type: CreatedAt.
   * @link CreatedAt
   * @example new Date()
   */
  createdAt: CreatedAt;
  /**
   * Field: roomId.
   * Type: RoomId.
   * @link RoomId
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
   * @link Author
   * @example "string"
   */
  author: Author;
  /**
   * Field: text.
   * Type: Text.
   * @link Text
   * @example "string"
   */
  text: Text;
  /**
   * Field: roomId.
   * Type: RoomId.
   * @link RoomId
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
   * @link Id
   * @example ...
   */
  _id: Id;
  /**
   * Field: name.
   * Type: Name.
   * @link Name
   * @example "string"
   */
  name: Name;
  /**
   * Field operation: User.greeting.
   * Constraints: owner="User", field="greeting", response="greeting", dependsOn="User".
   * Depends on: User.
   * @link User
   * @param input void
   * @returns greeting
   * @resolve greeting
   * @link greeting
   * @example await greeting()
   * @example greeting(): greeting
   */
  greeting?: UserGreetingField;
  /**
   * Field operation: User.friends.
   * Constraints: owner="User", field="friends", response="UserList", dependsOn="User".
   * Depends on: User.
   * @link User
   * @param input void
   * @returns UserList
   * @resolve UserList
   * @link UserList
   * @example await friends()
   * @example friends(): UserList
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
   * @link Id
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
 * @link User
 * @param input void
 * @returns UserList
 * @resolve UserList
 * @link UserList
 * @example await friends()
 * @example friends(): UserList
 */
export interface UserFriendsField {
  (): Promise<UserList>;
}

/**
 * Field operation: User.greeting.
 * Depends on: User.
 * @link User
 * @param input void
 * @returns greeting
 * @resolve greeting
 * @link greeting
 * @example await greeting()
 * @example greeting(): greeting
 */
export interface UserGreetingField {
  (): Promise<Greeting>;
}

/**
 * Operation: hello.
 * Constraints: publish=["onHello"], request="HelloInput", response="Hello".
 * @param input HelloInput
 * @link HelloInput
 * @returns Hello
 * @resolve Hello
 * @link Hello
 * Publishes events: onHello.
 * @example await client.hello({ userId: "string" })
 * @example hello({ userId: "string" }: HelloInput): Hello
 */
export interface HelloOperation {
  (input: HelloInput): Promise<Hello>;
}

/**
 * Operation: joinChat.
 * Constraints: publish=["onUserJoined"], request="UserInput", response="User".
 * @param input UserInput
 * @link UserInput
 * @returns User
 * @resolve User
 * @link User
 * Publishes events: onUserJoined.
 * @example await client.joinChat(...)
 * @example joinChat(...: UserInput): User
 */
export interface JoinChatOperation {
  (input: UserInput): Promise<User>;
}

/**
 * Operation: leaveChat.
 * Constraints: publish=["onUserLeft"], request="UserInput", response="User".
 * @param input UserInput
 * @link UserInput
 * @returns User
 * @resolve User
 * @link User
 * Publishes events: onUserLeft.
 * @example await client.leaveChat(...)
 * @example leaveChat(...: UserInput): User
 */
export interface LeaveChatOperation {
  (input: UserInput): Promise<User>;
}

/**
 * Operation: listUsers.
 * Constraints: request="ListUsersInput", response="UserList".
 * @param input ListUsersInput
 * @link ListUsersInput
 * @returns UserList
 * @resolve UserList
 * @link UserList
 * @example await client.listUsers({  })
 * @example listUsers({  }: ListUsersInput): UserList
 */
export interface ListUsersOperation {
  (input: ListUsersInput): Promise<UserList>;
}

/**
 * Operation: sendMessage.
 * Constraints: publish=["onMessage"], ack={"required":true,"mode":"received","timeoutMs":5000,"retries":3}, request="SendMessageInput", response="Message".
 * @param input SendMessageInput
 * @link SendMessageInput
 * @returns Message
 * @resolve Message
 * @link Message
 * Publishes events: onMessage.
 * @example await client.sendMessage({ author: "string", text: "string", roomId: "string" })
 * @example sendMessage({ author: "string", text: "string", roomId: "string" }: SendMessageInput): Message
 */
export interface SendMessageOperation {
  (input: SendMessageInput): Promise<Message>;
}

/**
 * Operation: user.
 * Constraints: request="UserInput", response="User".
 * @param input UserInput
 * @link UserInput
 * @returns User
 * @resolve User
 * @link User
 * @example await client.user({ _id: "string" })
 * @example user({ _id: "string" }: UserInput): User
 */
export interface UserOperation {
  (input: UserInput): Promise<User>;
}


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
  /**
   * Operation: hello.
   * Constraints: publish=["onHello"], request="HelloInput", response="Hello".
   * @param input HelloInput
   * @link HelloInput
   * @returns Hello
   * @resolve Hello
   * @link Hello
   * Publishes events: onHello.
   * @example await client.hello({ userId: "string" })
   * @example hello({ userId: "string" }: HelloInput): Hello
   */
  hello: HelloOperation;
  /**
   * Operation: joinChat.
   * Constraints: publish=["onUserJoined"], request="UserInput", response="User".
   * @param input UserInput
   * @link UserInput
   * @returns User
   * @resolve User
   * @link User
   * Publishes events: onUserJoined.
   * @example await client.joinChat(...)
   * @example joinChat(...: UserInput): User
   */
  joinChat: JoinChatOperation;
  /**
   * Operation: leaveChat.
   * Constraints: publish=["onUserLeft"], request="UserInput", response="User".
   * @param input UserInput
   * @link UserInput
   * @returns User
   * @resolve User
   * @link User
   * Publishes events: onUserLeft.
   * @example await client.leaveChat(...)
   * @example leaveChat(...: UserInput): User
   */
  leaveChat: LeaveChatOperation;
  /**
   * Operation: listUsers.
   * Constraints: request="ListUsersInput", response="UserList".
   * @param input ListUsersInput
   * @link ListUsersInput
   * @returns UserList
   * @resolve UserList
   * @link UserList
   * @example await client.listUsers({  })
   * @example listUsers({  }: ListUsersInput): UserList
   */
  listUsers: ListUsersOperation;
  /**
   * Operation: sendMessage.
   * Constraints: publish=["onMessage"], ack={"required":true,"mode":"received","timeoutMs":5000,"retries":3}, request="SendMessageInput", response="Message".
   * @param input SendMessageInput
   * @link SendMessageInput
   * @returns Message
   * @resolve Message
   * @link Message
   * Publishes events: onMessage.
   * @example await client.sendMessage({ author: "string", text: "string", roomId: "string" })
   * @example sendMessage({ author: "string", text: "string", roomId: "string" }: SendMessageInput): Message
   */
  sendMessage: SendMessageOperation;
  /**
   * Operation: user.
   * Constraints: request="UserInput", response="User".
   * @param input UserInput
   * @link UserInput
   * @returns User
   * @resolve User
   * @link User
   * @example await client.user({ _id: "string" })
   * @example user({ _id: "string" }: UserInput): User
   */
  user: UserOperation;
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
