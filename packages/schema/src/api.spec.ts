import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { api, composeApi, subscription } from './api.js';
import { fieldOperation, operation } from './operation.js';
import { createBaseSchemaMock } from './testing/mocks/index.js';

describe('api utilities', () => {
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

  describe('subscription()', () => {
    describe('happy', () => {
      it('should include optional fields when optional values are provided', () => {
        const payload = createBaseSchemaMock<{ id: string }>({
          name: 'Payload',
          type: 'payload',
        });
        const input = createBaseSchemaMock<{ room: string }>({
          name: 'Input',
          type: 'input',
        });
        const output = createBaseSchemaMock<{ event: string }>({
          name: 'Output',
          type: 'output',
        });
        const filter = vi.fn(() => true);
        const exec = vi.fn(() => ({ event: 'created' }));

        const result = subscription({
          name: 'userCreated',
          input,
          payload,
          output,
          filter,
          exec,
          doc: { summary: 'subscription doc' },
        });

        expect(result.type).toBe('subscription');
        expect(result.name).toBe('userCreated');
        expect(result.input).toBe(input);
        expect(result.payload).toBe(payload);
        expect(result.output).toBe(output);
        expect(result.filter).toBe(filter);
        expect(result.exec).toBe(exec);
        expect(result.doc).toEqual({ summary: 'subscription doc' });
      });
    });

    describe('sad', () => {
      it('should only include mandatory payload when optional values are omitted', () => {
        const payload = createBaseSchemaMock<{ id: string }>({
          name: 'Payload',
          type: 'payload',
        });

        const result = subscription({
          payload,
        });

        expect(result.type).toBe('subscription');
        expect(result.payload).toBe(payload);
        expect(result.input).toBeUndefined();
        expect(result.output).toBeUndefined();
        expect(result.filter).toBeUndefined();
        expect(result.exec).toBeUndefined();
      });
    });
  });

  describe('api()', () => {
    describe('happy', () => {
      it('should merge explicit and inline operations when both are provided', () => {
        const inputSchema = createBaseSchemaMock<string>({ name: 'Input', type: 'input', outputValue: 'x' });
        const explicitOperation = operation({
          input: inputSchema,
          exec: async () => 'explicit',
        });
        const inlineOperation = operation({
          input: inputSchema,
          exec: async () => 'inline',
        });

        const result = api({
          operations: {
            explicit: explicitOperation,
          },
          inline: inlineOperation,
        } as unknown as Parameters<typeof api>[0]);
        const operations = result.operations as Record<string, typeof explicitOperation>;

        expect(operations.explicit?.name).toBe('explicit');
        expect(operations.explicit?.exec).toBe(explicitOperation.exec);
        expect(operations.inline?.name).toBe('inline');
        expect(operations.inline?.exec).toBe(inlineOperation.exec);
      });

      it('should assign missing names to operations field operations and subscriptions', () => {
        const entity = createBaseSchemaMock<{ id: string }>({
          name: 'User',
          type: 'object',
          astNode: { type: 'object', name: 'User' },
          outputValue: { id: 'u-1' },
        });
        const inputSchema = createBaseSchemaMock<string>({ name: 'Input', type: 'input', outputValue: 'x' });
        const payloadSchema = createBaseSchemaMock<{ id: string }>({ name: 'Payload', type: 'payload' });
        const op = operation({
          input: inputSchema,
          exec: async () => 'ok',
        });
        const fieldOp = fieldOperation({
          dependsOn: entity,
          exec: async () => 'field',
        });
        const sub = subscription({
          payload: payloadSchema,
        });

        const result = api({
          type: entity,
          operations: {
            createUser: op,
          },
          fieldOperations: {
            displayName: fieldOp,
          },
          subscriptions: {
            userCreated: sub,
          },
        });

        expect(result.operations.createUser.name).toBe('createUser');
        expect(result.fieldOperations.displayName.name).toBe('displayName');
        expect(result.subscriptions.userCreated?.name).toBe('userCreated');
      });

      it('should build ast with operation subscription and field nodes when ast is requested', () => {
        const entity = createBaseSchemaMock<{ id: string }>({
          name: 'User',
          type: 'object',
          astNode: { type: 'object', name: 'User' },
          outputValue: { id: 'u-1' },
        });
        const operationInput = createBaseSchemaMock<{ name: string }>({
          name: 'OperationInput',
          type: 'operation-input',
          astNode: { type: 'object', name: 'OperationInput' },
          outputValue: { name: 'Alice' },
        });
        const operationOutput = createBaseSchemaMock<{ id: string }>({
          name: 'OperationOutput',
          type: 'operation-output',
          astNode: { type: 'object', name: 'OperationOutput' },
          outputValue: { id: 'u-1' },
        });
        const subscriptionPayload = createBaseSchemaMock<{ id: string }>({
          name: 'SubscriptionPayload',
          type: 'subscription-payload',
          astNode: { type: 'object', name: 'SubscriptionPayload' },
        });
        const fieldInput = createBaseSchemaMock<{ locale: string }>({
          name: 'FieldInput',
          type: 'field-input',
          astNode: { type: 'object', name: 'FieldInput' },
          outputValue: { locale: 'en' },
        });
        const fieldOutput = createBaseSchemaMock<{ value: string }>({
          name: 'FieldOutput',
          type: 'field-output',
          astNode: { type: 'object', name: 'FieldOutput' },
          outputValue: { value: 'Alice' },
        });
        const createUser = operation({
          input: operationInput,
          output: operationOutput,
          exec: async () => ({ id: 'u-1' }),
          publish: {
            userCreated: () => ({ id: 'u-1' }),
          },
          ack: { required: true, mode: 'handled' },
          doc: { summary: 'create user' },
        });
        const displayName = fieldOperation({
          dependsOn: entity,
          input: fieldInput,
          output: fieldOutput,
          exec: async () => ({ value: 'Alice' }),
          doc: { summary: 'field doc' },
        });
        const userCreated = subscription({
          payload: subscriptionPayload,
          doc: { summary: 'sub doc' },
        });
        const result = api({
          doc: { summary: 'api doc' },
          type: entity,
          operations: { createUser },
          fieldOperations: { displayName },
          subscriptions: { userCreated },
        });

        const ast = result.ast();
        const operationNode = ast.children?.find((node) => node.type === 'operation');
        const subscriptionNode = ast.children?.find((node) => node.type === 'subscription');
        const fieldNode = ast.children?.find((node) => node.type === 'field');

        expect(ast.type).toBe('api');
        expect(ast.doc).toEqual({ summary: 'api doc' });
        expect(operationNode).toMatchObject({
          name: 'createUser',
          constraints: {
            publish: ['userCreated'],
            ack: { required: true, mode: 'handled' },
            request: 'OperationInput',
            response: 'OperationOutput',
          },
        });
        expect(subscriptionNode).toMatchObject({
          name: 'userCreated',
          constraints: {
            payload: 'SubscriptionPayload',
            output: 'SubscriptionPayload',
          },
        });
        expect(fieldNode).toMatchObject({
          name: 'User.displayName',
          constraints: {
            owner: 'User',
            field: 'displayName',
            request: 'FieldInput',
            response: 'FieldOutput',
            dependsOn: 'User',
          },
        });
      });
    });

    describe('sad', () => {
      it('should throw when field operations are provided without entity type', () => {
        const fieldOp = fieldOperation({
          dependsOn: createBaseSchemaMock<{ id: string }>({ outputValue: { id: 'u-1' } }),
          exec: async () => 'field',
        });

        expect(() =>
          api({
            fieldOperations: {
              displayName: fieldOp,
            },
          } as unknown as Parameters<typeof api>[0]),
        ).toThrowError('api.type is required when fieldOperations are provided.');
      });

      it('should throw when operation publishes topic without matching subscription', () => {
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'x' });
        const publishingOperation = operation({
          input: inputSchema,
          exec: async () => 'ok',
          publish: {
            missingTopic: () => ({ payload: true }),
          },
        });

        expect(() =>
          api({
            operations: {
              createUser: publishingOperation,
            },
          } as unknown as Parameters<typeof api>[0]),
        ).toThrowError(
          'api: operation "createUser" publishes "missingTopic" but no subscription with that name exists.',
        );
      });
    });
  });

  describe('composeApi()', () => {
    describe('happy', () => {
      it('should compose operations field operations and subscriptions from multiple apis', () => {
        const userSchema = createBaseSchemaMock<{ id: string }>({
          name: 'User',
          type: 'object',
          astNode: { type: 'object', name: 'User' },
          outputValue: { id: 'u-1' },
        });
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'x' });
        const payloadSchema = createBaseSchemaMock<{ id: string }>({ name: 'Payload', type: 'payload' });
        const usersApi = api({
          type: userSchema,
          operations: {
            createUser: operation({
              input: inputSchema,
              exec: async () => 'ok',
            }),
          },
          fieldOperations: {
            displayName: fieldOperation({
              dependsOn: userSchema,
              exec: async () => 'name',
            }),
          },
          subscriptions: {
            userCreated: subscription({ payload: payloadSchema }),
          },
        });
        const systemApi = api({
          operations: {
            health: operation({
              input: inputSchema,
              exec: async () => 'ok',
            }),
          },
        });

        const composed = composeApi({
          users: usersApi,
          system: systemApi,
        });
        const ast = composed.ast();

        expect(composed.type).toBe('api-composed');
        expect(Object.keys(composed.operations)).toEqual(['createUser', 'health']);
        expect(Object.keys(composed.fieldOperations)).toEqual(['User.displayName']);
        expect(Object.keys(composed.subscriptions)).toEqual(['userCreated']);
        expect(ast.type).toBe('api-composed');
        expect(ast.children?.map((node) => node.name)).toEqual(['users', 'system']);
      });
    });

    describe('sad', () => {
      it('should throw when two apis contain duplicate operation names', () => {
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'x' });
        const left = api({
          operations: {
            ping: operation({ input: inputSchema, exec: async () => 'left' }),
          },
        });
        const right = api({
          operations: {
            ping: operation({ input: inputSchema, exec: async () => 'right' }),
          },
        });

        expect(() =>
          composeApi({
            left,
            right,
          }),
        ).toThrowError('composeApi: duplicate operation name "ping"');
      });

      it('should throw when two apis contain duplicate field operation names', () => {
        const owner = createBaseSchemaMock<{ id: string }>({
          name: 'User',
          type: 'object',
          astNode: { type: 'object', name: 'User' },
          outputValue: { id: 'u-1' },
        });
        const left = api({
          type: owner,
          fieldOperations: {
            displayName: fieldOperation({
              dependsOn: owner,
              exec: async () => 'left',
            }),
          },
        } as unknown as Parameters<typeof api>[0]);
        const right = api({
          type: owner,
          fieldOperations: {
            displayName: fieldOperation({
              dependsOn: owner,
              exec: async () => 'right',
            }),
          },
        } as unknown as Parameters<typeof api>[0]);

        expect(() =>
          composeApi({
            left,
            right,
          }),
        ).toThrowError('composeApi: duplicate field operation name "User.displayName"');
      });

      it('should throw when two apis contain duplicate subscription names', () => {
        const payload = createBaseSchemaMock<{ id: string }>({ name: 'Payload', type: 'payload' });
        const left = api({
          subscriptions: {
            userCreated: subscription({ payload }),
          },
        } as unknown as Parameters<typeof api>[0]);
        const right = api({
          subscriptions: {
            userCreated: subscription({ payload }),
          },
        } as unknown as Parameters<typeof api>[0]);

        expect(() =>
          composeApi({
            left,
            right,
          }),
        ).toThrowError('composeApi: duplicate subscription name "userCreated"');
      });
    });
  });
});
