import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { generateClientFiles, type AstNode } from './generate.js';

const createMessageNode = (withDoc: boolean): AstNode => ({
  type: 'object',
  name: 'Message',
  ...(withDoc ? { doc: { summary: 'Chat message payload used in subscriptions.' } } : {}),
  children: [
    {
      type: 'field',
      name: 'text',
      children: [
        {
          type: 'string',
          name: 'messageText',
        },
      ],
    },
  ],
});

const createSubscriptionAst = (withDoc: boolean): AstNode => ({
  type: 'api',
  children: [
    {
      type: 'subscription',
      name: 'onMessage',
      ...(withDoc ? { doc: { summary: 'Triggered when a new message is published.' } } : {}),
      constraints: {
        payload: 'Message',
        output: 'Message',
      },
      response: 'Message',
      children: [createMessageNode(withDoc)],
    },
  ],
});

const createPublishOnlyAst = (): AstNode => ({
  type: 'api',
  children: [
    {
      type: 'operation',
      name: 'sendMessage',
      constraints: {
        publish: ['onMessage'],
        request: 'MessageInput',
        response: 'Message',
      },
      request: 'MessageInput',
      response: 'Message',
      children: [
        {
          type: 'object',
          name: 'MessageInput',
          children: [
            {
              type: 'field',
              name: 'text',
              children: [
                {
                  type: 'string',
                  name: 'messageText',
                },
              ],
            },
          ],
        },
        createMessageNode(true),
      ],
    },
  ],
});

const createAndOutputAst = (): AstNode => ({
  type: 'api',
  children: [
    {
      type: 'operation',
      name: 'sendMessage',
      constraints: {
        request: 'MessageInput',
        response: 'MessageWithId',
      },
      request: 'MessageInput',
      response: 'MessageWithId',
      children: [
        {
          type: 'object',
          name: 'MessageInput',
          children: [
            {
              type: 'field',
              name: 'text',
              children: [{ type: 'string', name: 'messageText' }],
            },
          ],
        },
        {
          type: 'and',
          name: 'MessageWithId',
          children: [
            {
              type: 'object',
              name: 'MessageInput',
              children: [
                {
                  type: 'field',
                  name: 'text',
                  children: [{ type: 'string', name: 'messageText' }],
                },
              ],
            },
            {
              type: 'object',
              name: 'WithId',
              children: [
                {
                  type: 'field',
                  name: 'id',
                  children: [{ type: 'string', name: 'id' }],
                },
              ],
            },
          ],
        },
      ],
    },
  ],
});

describe('generateClientFiles()', () => {
  beforeAll(() => {
    vi.useRealTimers();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('happy', () => {
    it('should include subscription jsdoc when subscription docs are provided', () => {
      const files = generateClientFiles({
        ast: createSubscriptionAst(true),
      }).files;

      const source = files['api.ts'];

      expect(source).toContain('export interface OnMessageSubscription {');
      expect(source).toContain('Triggered when a new message is published.');
      expect(source).toContain('Subscription handler for "onMessage".');
      expect(source).toContain('Payload doc: Chat message payload used in subscriptions.');
      expect(source).toContain('@param payload - Message payload emitted for "onMessage".');
      expect(source).toContain('See {@link Message} and {@link ClientHandlerContext}.');
      expect(source).toContain('@example');
      expect(source).toContain('export interface SubscriptionHandlers {');
      expect(source).toContain('onMessage?(payload: Message, ctx: ClientHandlerContext): void;');
    });

    it('should include subscription jsdoc when events are declared only through publish constraints', () => {
      const files = generateClientFiles({
        ast: createPublishOnlyAst(),
      }).files;

      const source = files['api.ts'];

      expect(source).toContain('export interface OnMessageSubscription {');
      expect(source).toContain('@param payload - Message payload emitted for "onMessage".');
      expect(source).toContain('export interface SubscriptionHandlers {');
      expect(source).toContain('onMessage?(payload: Message, ctx: ClientHandlerContext): void;');
      expect(source).not.toContain('export type SubscriptionHandlers = Partial<{ [K in SubscriptionName]: SubscriptionHandler<K> }>;');
    });

    it('should generate livon client operation methods with inline signatures when operations are present', () => {
      const files = generateClientFiles({
        ast: createPublishOnlyAst(),
      }).files;

      const source = files['api.ts'];

      expect(source).toContain('sendMessage(input: MessageInput): Promise<Message>;');
      expect(source).not.toContain('sendMessage: SendMessageOperation;');
      expect(source).toContain('@returns Message operation result.');
      expect(source).toContain('Output type: Message.');
    });

    it('should render and schema output as intersection type when ast contains and node', () => {
      const files = generateClientFiles({
        ast: createAndOutputAst(),
      }).files;

      const source = files['api.ts'];

      expect(source).toContain('export type MessageWithId = MessageInput & WithId;');
      expect(source).toContain('sendMessage(input: MessageInput): Promise<MessageWithId>;');
      expect(source).toContain('Output type: MessageWithId.');
    });
  });

  describe('sad', () => {
    it('should include default subscription jsdoc when subscription docs are omitted', () => {
      const files = generateClientFiles({
        ast: createSubscriptionAst(false),
      }).files;

      const source = files['api.ts'];

      expect(source).toContain('export interface OnMessageSubscription {');
      expect(source).toContain('Subscription handler for "onMessage".');
      expect(source).toContain('@param payload - Message payload emitted for "onMessage".');
      expect(source).toContain('onMessage?(payload: Message, ctx: ClientHandlerContext): void;');
      expect(source).not.toContain('Payload doc:');
    });
  });
});
