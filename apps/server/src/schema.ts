import {
  api,
  array,
  date,
  fieldOperation,
  object,
  operation,
  string,
  subscription,
} from '@livon/schema';

const UserId = string({ name: '_id' });
const MessageId = string({ name: 'messageId' });
const MessageAuthor = string({ name: 'author' });
const MessageText = string({ name: 'text' });
const MessageTimestamp = date({ name: 'createdAt' });
const RoomId = string({ name: 'roomId' });
const HelloUserId = string({ name: 'helloUserId' });

const User = object({
  name: 'User',
  shape: {
    _id: UserId,
    name: string({ name: 'name' }),
  },
});

const UserInput = object({
  name: 'UserInput',
  shape: {
    _id: UserId,
  },
});

const Message = object({
  name: 'Message',
  shape: {
    id: MessageId,
    author: MessageAuthor,
    text: MessageText,
    createdAt: MessageTimestamp,
    roomId: RoomId,
  },
});

const SendMessageInput = object({
  name: 'SendMessageInput',
  shape: {
    author: MessageAuthor,
    text: MessageText,
    roomId: RoomId,
  },
});

const HelloInput = object({
  name: 'HelloInput',
  shape: {
    userId: HelloUserId,
  },
});

const Hello = object({
  name: 'Hello',
  shape: {
    userId: HelloUserId,
  },
});

const UserList = array({
  name: 'UserList',
  item: User,
});

const ListUsersInput = object({
  name: 'ListUsersInput',
  shape: {},
});

const activeUsers = new Map<string, { _id: string; name: string }>();
const clientToUser = new Map<string, string>();
const userConnections = new Map<string, Set<string>>();

const attachClientToUser = (clientId: string, userId: string) => {
  clientToUser.set(clientId, userId);
  const existing = userConnections.get(userId) ?? new Set<string>();
  existing.add(clientId);
  userConnections.set(userId, existing);
};

const removeUserConnection = (clientId: string): { _id: string; name: string } | undefined => {
  const userId = clientToUser.get(clientId);
  if (!userId) {
    return undefined;
  }

  clientToUser.delete(clientId);
  const set = userConnections.get(userId);
  if (set) {
    set.delete(clientId);
    if (set.size === 0) {
      userConnections.delete(userId);
    }
  }

  if (set && set.size > 0) {
    return undefined;
  }

  const removed = activeUsers.get(userId);
  if (removed) {
    activeUsers.delete(userId);
  }
  return removed;
};

export const disconnectUserByClientId = (clientId: string) => removeUserConnection(clientId);

const userOperation = operation({
  input: UserInput,
  output: User,
  exec: async (input) => {
    return { _id: input._id, name: `User-${input._id}` };
  },
});

const listUsersOperation = operation({
  input: ListUsersInput,
  output: UserList,
  exec: async () => {
    return Array.from(activeUsers.values());
  },
});

const joinChatOperation = operation({
  input: UserInput,
  output: User,
  exec: async (input, ctx) => {
    const user = { _id: input._id, name: input._id };
    activeUsers.set(user._id, user);

    const clientId = typeof ctx.request?.sourceId === 'string' ? ctx.request.sourceId : undefined;
    if (clientId) {
      attachClientToUser(clientId, user._id);
    }

    return user;
  },
  publish: {
    onUserJoined: (output) => output,
  },
});

const leaveChatOperation = operation({
  input: UserInput,
  output: User,
  exec: async (input) => {
    const removed = activeUsers.get(input._id) ?? { _id: input._id, name: input._id };
    activeUsers.delete(input._id);

    const connections = userConnections.get(input._id);
    if (connections) {
      connections.forEach((clientId) => {
        clientToUser.delete(clientId);
      });
      userConnections.delete(input._id);
    }

    return removed;
  },
  publish: {
    onUserLeft: (output) => output,
  },
});

const helloOperation = operation({
  input: HelloInput,
  output: Hello,
  exec: async (input) => {
    return { userId: input.userId };
  },
  publish: {
    onHello: (output) => output,
  },
});

const sendMessageOperation = operation({
  input: SendMessageInput,
  output: Message,
  exec: async (input) => {
    return {
      id: globalThis.crypto?.randomUUID?.() ?? `msg-${Date.now()}`,
      author: input.author,
      text: input.text,
      createdAt: new Date(),
      roomId: input.roomId,
    };
  },
  rooms: (input) => {
    if (input.roomId === 'global') {
      return undefined;
    }
    return input.roomId;
  },
  publish: {
    onMessage: (output) => output,
  },
  ack: {
    required: true,
    mode: 'received',
    timeoutMs: 5000,
    retries: 3,
  },
});

const Greeting = string({ name: 'greeting' });

const userGreeting = fieldOperation({
  dependsOn: User,
  output: Greeting,
  exec: (user) => `Hello ${user.name}`,
});

const userFriends = fieldOperation({
  dependsOn: User,
  output: UserList,
  exec: (user) => {
    const friend1 = { _id: `${user._id}-friend-1`, name: 'Friend-1' };
    const friend2 = { _id: `${user._id}-friend-2`, name: 'Friend-2' };
    return [friend1, friend2];
  },
});

const onUserJoinedSubscription = subscription({
  input: UserInput,
  payload: User,
  output: User,
});

const onUserLeftSubscription = subscription({
  input: UserInput,
  payload: User,
  output: User,
});

const onHelloSubscription = subscription({
  input: HelloInput,
  payload: Hello,
  output: Hello,
});

const onMessageSubscription = subscription({
  input: SendMessageInput,
  payload: Message,
  output: Message,
  filter: (input, payload) => input.roomId === payload.roomId,
  exec: (_input, payload) => payload,
});

export const serverApi: ReturnType<typeof api> = api({
  type: User,
  operations: {
    user: userOperation,
    listUsers: listUsersOperation,
    joinChat: joinChatOperation,
    leaveChat: leaveChatOperation,
    hello: helloOperation,
    sendMessage: sendMessageOperation,
  },
  subscriptions: {
    onUserJoined: onUserJoinedSubscription,
    onUserLeft: onUserLeftSubscription,
    onHello: onHelloSubscription,
    onMessage: onMessageSubscription,
  },
  fieldOperations: {
    greeting: userGreeting,
    friends: userFriends,
  },
});

export const serverSchema = serverApi;
