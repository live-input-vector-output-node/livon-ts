import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSchemaContext } from './context.js';
import {
  fieldOperation,
  operation,
  runFieldOperation,
  runOperation,
  withFieldOperationName,
  withOperationName,
} from './operation.js';
import { string } from './string.js';
import { createBaseSchemaMock } from './testing/mocks/index.js';
import type { SchemaContext } from './types.js';

describe('operation utilities', () => {
  let context: SchemaContext;

  beforeAll(() => {
    context = createSchemaContext();
  });

  beforeEach(() => {
    context = createSchemaContext();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  describe('operation()', () => {
    describe('happy', () => {
      it('should return operation payload when output schema is provided', () => {
        const inputSchema = createBaseSchemaMock<{ id: string }>({
          name: 'Input',
          type: 'input',
          outputValue: { id: 'u-1' },
        });
        const outputSchema = createBaseSchemaMock<{ ok: boolean }>({
          name: 'Output',
          type: 'output',
          outputValue: { ok: true },
        });
        const exec = vi.fn(async () => ({ ok: true }));

        const result = operation({
          input: inputSchema,
          output: outputSchema,
          exec,
          doc: { summary: 'operation doc' },
        });

        expect(result.type).toBe('operation');
        expect(result.input).toBe(inputSchema);
        expect(result.output).toBe(outputSchema);
        expect(result.exec).toBe(exec);
        expect(result.doc).toEqual({ summary: 'operation doc' });
      });
    });

    describe('sad', () => {
      it('should keep output undefined when output schema is omitted', () => {
        const inputSchema = createBaseSchemaMock<string>({
          outputValue: 'input',
        });

        const result = operation({
          input: inputSchema,
          exec: (input) => input.length,
        });

        expect(result.output).toBeUndefined();
      });
    });
  });

  describe('fieldOperation()', () => {
    describe('happy', () => {
      it('should normalize shape dependsOn and shape input when shape values are provided', () => {
        const result = fieldOperation({
          dependsOn: {
            id: string(),
          },
          input: {
            name: string(),
          },
          exec: () => 'ok',
        });

        expect(result.type).toBe('field');
        expect(result.dependsOn.name).toBe('dependsOn');
        expect(result.input?.name).toBe('input');
      });

      it('should keep provided schema dependsOn without wrapping when schema is provided', () => {
        const dependsOn = createBaseSchemaMock<{ id: string }>({
          name: 'DependsOnSchema',
          type: 'dependsOn',
          outputValue: { id: 'u-1' },
        });

        const result = fieldOperation({
          dependsOn,
          exec: () => 'ok',
        });

        expect(result.dependsOn).toBe(dependsOn);
      });
    });

    describe('sad', () => {
      it('should keep output undefined when output is omitted', () => {
        const dependsOn = createBaseSchemaMock<{ id: string }>({
          outputValue: { id: 'u-1' },
        });

        const result = fieldOperation({
          dependsOn,
          exec: () => 'ok',
        });

        expect(result.output).toBeUndefined();
      });
    });
  });

  describe('withOperationName()', () => {
    describe('happy', () => {
      it('should set operation name when wrapper is used', () => {
        const op = operation({
          input: createBaseSchemaMock<string>({ outputValue: 'value' }),
          exec: () => 'ok',
        });

        const named = withOperationName({
          name: 'createUser',
          operation: op,
        });

        expect(named.name).toBe('createUser');
        expect(named.type).toBe('operation');
      });
    });

    describe('sad', () => {
      it('should preserve original operation members when name is injected', () => {
        const exec = vi.fn(async () => 'ok');
        const op = operation({
          input: createBaseSchemaMock<string>({ outputValue: 'value' }),
          exec,
        });

        const named = withOperationName({
          name: 'createUser',
          operation: op,
        });

        expect(named.exec).toBe(exec);
      });
    });
  });

  describe('withFieldOperationName()', () => {
    describe('happy', () => {
      it('should set field operation name when wrapper is used', () => {
        const op = fieldOperation({
          dependsOn: createBaseSchemaMock<{ id: string }>({ outputValue: { id: 'u-1' } }),
          exec: () => 'ok',
        });

        const named = withFieldOperationName({
          name: 'user.displayName',
          operation: op,
        });

        expect(named.name).toBe('user.displayName');
        expect(named.type).toBe('field');
      });
    });

    describe('sad', () => {
      it('should preserve original field operation members when name is injected', () => {
        const exec = vi.fn(async () => 'ok');
        const dependsOn = createBaseSchemaMock<{ id: string }>({ outputValue: { id: 'u-1' } });
        const op = fieldOperation({
          dependsOn,
          exec,
        });

        const named = withFieldOperationName({
          name: 'user.displayName',
          operation: op,
        });

        expect(named.dependsOn).toBe(dependsOn);
        expect(named.exec).toBe(exec);
      });
    });
  });

  describe('runOperation()', () => {
    describe('happy', () => {
      it('should parse input and output and publish to all rooms when publish hook returns payload', async () => {
        const parsedInput = { id: 'u-1' };
        const parsedOutput = { id: 'result' };
        const inputSchema = createBaseSchemaMock<typeof parsedInput>({
          outputValue: parsedInput,
        });
        const outputSchema = createBaseSchemaMock<typeof parsedOutput>({
          outputValue: parsedOutput,
        });
        const publisher = vi.fn(async () => undefined);
        const publishHook = vi.fn(() => ({ event: 'created' }));
        const exec = vi.fn(async () => ({ raw: true }));
        context = createSchemaContext({
          request: {
            publisher,
          },
        });

        const op = operation({
          input: inputSchema,
          output: outputSchema,
          publish: {
            userCreated: publishHook,
          },
          rooms: () => ['room-a', 'room-b'],
          ack: { required: true, mode: 'processed' },
          exec,
        });

        const result = await runOperation(op, { rawInput: true }, context);

        expect(exec).toHaveBeenCalledWith(parsedInput, context);
        expect(outputSchema.parse).toHaveBeenCalledWith({ raw: true }, context);
        expect(publishHook).toHaveBeenCalledWith(parsedOutput, context);
        expect(publisher).toHaveBeenCalledTimes(2);
        expect(publisher).toHaveBeenNthCalledWith(1, {
          topic: 'userCreated',
          payload: { event: 'created' },
          input: parsedInput,
          ack: { required: true, mode: 'processed' },
          meta: { room: 'room-a' },
        });
        expect(publisher).toHaveBeenNthCalledWith(2, {
          topic: 'userCreated',
          payload: { event: 'created' },
          input: parsedInput,
          ack: { required: true, mode: 'processed' },
          meta: { room: 'room-b' },
        });
        expect(result).toEqual(parsedOutput);
      });

      it('should skip publish when request publisher is missing', async () => {
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'parsed-input' });
        const outputSchema = createBaseSchemaMock<string>({ outputValue: 'parsed-output' });
        const publishHook = vi.fn(() => 'payload');
        const exec = vi.fn(async () => 'result');
        context = createSchemaContext();
        const op = operation({
          input: inputSchema,
          output: outputSchema,
          publish: {
            topic: publishHook,
          },
          exec,
        });

        const result = await runOperation(op, 'raw-input', context);

        expect(result).toBe('parsed-output');
        expect(publishHook).not.toHaveBeenCalled();
      });
    });

    describe('sad', () => {
      it('should report publish hook errors when publish hook throws', async () => {
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'parsed-input' });
        const publisher = vi.fn(async () => undefined);
        const publishHookError = new Error('hook failed');
        const publishHook = vi.fn(() => {
          throw publishHookError;
        });
        const onPublishError = vi.fn();
        const logger = { error: vi.fn() };
        context = createSchemaContext({
          request: {
            publisher,
            onPublishError,
            logger,
          },
        });
        const op = operation({
          input: inputSchema,
          exec: async () => 'output',
          publish: {
            topic: publishHook,
          },
        });

        await runOperation(op, 'raw-input', context);

        expect(onPublishError).toHaveBeenCalledWith(publishHookError, {
          topic: 'topic',
          phase: 'publish-hook',
        });
        expect(logger.error).toHaveBeenCalled();
      });

      it('should report publisher errors when publisher throws', async () => {
        const inputSchema = createBaseSchemaMock<string>({ outputValue: 'parsed-input' });
        const publisherError = new Error('publisher failed');
        const publisher = vi.fn(async () => {
          throw publisherError;
        });
        const onPublishError = vi.fn();
        const logger = { error: vi.fn() };
        context = createSchemaContext({
          request: {
            publisher,
            onPublishError,
            logger,
          },
        });
        const op = operation({
          input: inputSchema,
          exec: async () => 'output',
          publish: {
            topic: () => ({ ok: true }),
          },
        });

        await runOperation(op, 'raw-input', context);

        expect(onPublishError).toHaveBeenCalledWith(publisherError, {
          topic: 'topic',
          phase: 'publisher',
        });
        expect(logger.error).toHaveBeenCalled();
      });
    });
  });

  describe('runFieldOperation()', () => {
    describe('happy', () => {
      it('should parse dependsOn and input and output when input and output schemas are provided', async () => {
        const parsedDependsOn = { id: 'u-1' };
        const parsedInput = { field: 'name' };
        const parsedOutput = { value: 'Alice' };
        const dependsOnSchema = createBaseSchemaMock<typeof parsedDependsOn>({
          outputValue: parsedDependsOn,
        });
        const inputSchema = createBaseSchemaMock<typeof parsedInput>({
          outputValue: parsedInput,
        });
        const outputSchema = createBaseSchemaMock<typeof parsedOutput>({
          outputValue: parsedOutput,
        });
        const exec = vi.fn(async () => ({ raw: true }));
        const op = fieldOperation({
          dependsOn: dependsOnSchema,
          input: inputSchema,
          output: outputSchema,
          exec,
        });

        const result = await runFieldOperation(op, { rawDependsOn: true }, { rawInput: true }, context);

        expect(dependsOnSchema.parse).toHaveBeenCalledWith({ rawDependsOn: true }, context);
        expect(inputSchema.parse).toHaveBeenCalledWith({ rawInput: true }, context);
        expect(exec).toHaveBeenCalledWith(parsedDependsOn, parsedInput, context);
        expect(outputSchema.parse).toHaveBeenCalledWith({ raw: true }, context);
        expect(result).toEqual(parsedOutput);
      });

      it('should treat second parameter as context when input schema is missing', async () => {
        const parsedDependsOn = { id: 'u-1' };
        const dependsOnSchema = createBaseSchemaMock<typeof parsedDependsOn>({
          outputValue: parsedDependsOn,
        });
        const exec = vi.fn(async () => 'resolved');
        const op = fieldOperation({
          dependsOn: dependsOnSchema,
          exec,
        });

        const result = await runFieldOperation(op, { rawDependsOn: true }, context);

        expect(exec).toHaveBeenCalledWith(parsedDependsOn, context);
        expect(result).toBe('resolved');
      });
    });

    describe('sad', () => {
      it('should create request context when context has no request before execution', async () => {
        const dependsOnSchema = createBaseSchemaMock<{ id: string }>({
          outputValue: { id: 'u-1' },
        });
        context = createSchemaContext();
        const op = fieldOperation({
          dependsOn: dependsOnSchema,
          exec: async () => 'ok',
        });

        await runFieldOperation(op, { rawDependsOn: true }, context);

        expect(context.getRequestContext()).toBeDefined();
      });
    });
  });
});
