import { createLivonRemoteFunction, registerLivonSubscription } from '@livon/client';
import type { LivonSubscriptionHandler, LivonUnsubscribe } from '@livon/client';

export const LIVON_CONTRACT_HASH = 'demo-cache';
export const LIVON_CONTRACT_VERSION = 'demo-cache';

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

export const user: UserFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'user',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const listUsers: ListUsersFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'listUsers',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const joinChat: JoinChatFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'joinChat',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const leaveChat: LeaveChatFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'leaveChat',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const hello: HelloFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'hello',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const sendMessage: SendMessageFunction = createLivonRemoteFunction({
  endpointUrl: 'ws://127.0.0.1:3002/ws',
  remoteIdentifier: 'sendMessage',
  contractVersion: LIVON_CONTRACT_VERSION,
});

export const registerLivonSubscriptionHandlers = (handlers: LivonSubscriptionHandlers): LivonUnsubscribe => {
  const subscriptions: LivonUnsubscribe[] = [];
  if (handlers.onUserJoined) {
    subscriptions.push(registerLivonSubscription({ remoteIdentifier: 'onUserJoined', handler: handlers.onUserJoined }).unsubscribe);
  }
  if (handlers.onUserLeft) {
    subscriptions.push(registerLivonSubscription({ remoteIdentifier: 'onUserLeft', handler: handlers.onUserLeft }).unsubscribe);
  }
  if (handlers.onHello) {
    subscriptions.push(registerLivonSubscription({ remoteIdentifier: 'onHello', handler: handlers.onHello }).unsubscribe);
  }
  if (handlers.onMessage) {
    subscriptions.push(registerLivonSubscription({ remoteIdentifier: 'onMessage', handler: handlers.onMessage }).unsubscribe);
  }
  return () => subscriptions.forEach((unsubscribe) => unsubscribe());
};

export interface LivonGeneratedApi {
  (handlers: LivonSubscriptionHandlers): LivonUnsubscribe;
  user: UserFunction;
  listUsers: ListUsersFunction;
  joinChat: JoinChatFunction;
  leaveChat: LeaveChatFunction;
  hello: HelloFunction;
  sendMessage: SendMessageFunction;
}

export const api = Object.assign(
  (handlers: LivonSubscriptionHandlers) => registerLivonSubscriptionHandlers(handlers),
  {
    user,
    listUsers,
    joinChat,
    leaveChat,
    hello,
    sendMessage,
  },
) as LivonGeneratedApi;
