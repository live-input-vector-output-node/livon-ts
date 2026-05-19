import type { LivonSubscriptionHandler, LivonUnsubscribe } from '@livon/client';

export declare const LIVON_CONTRACT_HASH: 'demo-cache';
export declare const LIVON_CONTRACT_VERSION: 'demo-cache';

export interface User {
  _id: string;
  name: string;
}

export interface UserInput {
  _id: string;
}

export interface Message {
  id: string;
  author: string;
  text: string;
  createdAt: Date;
  roomId: string;
}

export interface SendMessageInput {
  author: string;
  text: string;
  roomId: string;
}

export interface HelloInput {
  userId: string;
}

export interface Hello {
  userId: string;
}

export interface ListUsersInput {}

export type UserList = User[];

export interface UserFunction {
  (input: UserInput): Promise<User>;
}

export interface ListUsersFunction {
  (input: ListUsersInput): Promise<UserList>;
}

export interface JoinChatFunction {
  (input: UserInput): Promise<User>;
}

export interface LeaveChatFunction {
  (input: UserInput): Promise<User>;
}

export interface HelloFunction {
  (input: HelloInput): Promise<Hello>;
}

export interface SendMessageFunction {
  (input: SendMessageInput): Promise<Message>;
}

export interface LivonSubscriptionMap {
  onUserJoined: User;
  onUserLeft: User;
  onHello: Hello;
  onMessage: Message;
}

export interface LivonSubscriptionHandlers {
  onUserJoined?: LivonSubscriptionHandler<User>;
  onUserLeft?: LivonSubscriptionHandler<User>;
  onHello?: LivonSubscriptionHandler<Hello>;
  onMessage?: LivonSubscriptionHandler<Message>;
}

export declare const user: UserFunction;
export declare const listUsers: ListUsersFunction;
export declare const joinChat: JoinChatFunction;
export declare const leaveChat: LeaveChatFunction;
export declare const hello: HelloFunction;
export declare const sendMessage: SendMessageFunction;

export declare const registerLivonSubscriptionHandlers: (
  handlers: LivonSubscriptionHandlers,
) => LivonUnsubscribe;

export interface LivonGeneratedApi {
  (handlers: LivonSubscriptionHandlers): LivonUnsubscribe;
  user: UserFunction;
  listUsers: ListUsersFunction;
  joinChat: JoinChatFunction;
  leaveChat: LeaveChatFunction;
  hello: HelloFunction;
  sendMessage: SendMessageFunction;
}

export declare const api: LivonGeneratedApi;
