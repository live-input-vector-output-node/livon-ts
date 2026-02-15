import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createBuilder,
  createSchemaContext,
  createState,
  isNormalizedRequest,
  normalizeBuildContext,
  normalizeRequestContext,
} from './context.js';
import type { AstNode, SchemaBuildContextInput, SchemaRequestContextInput } from './types.js';

describe('context utilities', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;
  let randomSpy: ReturnType<typeof vi.spyOn>;
  let buildInput: SchemaBuildContextInput;
  let requestInput: SchemaRequestContextInput;

  beforeAll(() => {
    dateNowSpy = vi.spyOn(Date, 'now');
    randomSpy = vi.spyOn(Math, 'random');
    buildInput = {};
    requestInput = {};
  });

  beforeEach(() => {
    dateNowSpy.mockReturnValue(1700000000000);
    randomSpy.mockReturnValue(0.25);
    buildInput = {};
    requestInput = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
    buildInput = {};
    requestInput = {};
  });

  afterAll(() => {
    dateNowSpy.mockRestore();
    randomSpy.mockRestore();
  });

  describe('createBuilder()', () => {
    describe('happy', () => {
      it('should collect ast nodes when add is called', () => {
        const builder = createBuilder();
        const node: AstNode = { type: 'string', name: 'UserName' };

        const addedNode = builder.add(node);
        const allNodes = builder.getAll();

        expect(addedNode).toBe(node);
        expect(allNodes).toEqual([node]);
      });
    });

    describe('sad', () => {
      it('should return empty list when no nodes are added', () => {
        const builder = createBuilder();

        expect(builder.getAll()).toEqual([]);
      });
    });
  });

  describe('createState()', () => {
    describe('happy', () => {
      it('should store and read value when set is called before get', () => {
        const state = createState();

        state.set('userId', 'u-1');

        expect(state.get('userId')).toBe('u-1');
      });

      it('should update value when update is called', () => {
        const state = createState();

        state.set('counter', 1);
        state.update<number>('counter', (current) => (current ?? 0) + 1);

        expect(state.get('counter')).toBe(2);
      });

      it('should include all entries when snapshot is called', () => {
        const state = createState();

        state.set('tenantId', 't-1');
        state.set('isAdmin', true);

        expect(state.snapshot()).toEqual({
          tenantId: 't-1',
          isAdmin: true,
        });
      });
    });

    describe('sad', () => {
      it('should provide undefined when key was never set', () => {
        const state = createState();

        expect(state.get('missing')).toBeUndefined();
      });

      it('should pass undefined to updater when value is missing', () => {
        const state = createState();
        const updater = vi.fn((current: number | undefined) => (current ?? 0) + 10);

        state.update('counter', updater);

        expect(updater).toHaveBeenCalledWith(undefined);
        expect(state.get('counter')).toBe(10);
      });
    });
  });

  describe('normalizeBuildContext()', () => {
    describe('happy', () => {
      it('should create defaults when input is missing', () => {
        const context = normalizeBuildContext();

        expect(context.buildId).toBe('1700000000000-4');
        expect(context.schemaPath).toEqual([]);
        expect(context.buildOptions).toEqual({});
        expect(context.builder.getAll()).toEqual([]);
      });

      it('should keep provided values when input provides them', () => {
        const builder = createBuilder();
        buildInput = {
          buildId: 'custom-build',
          builder,
          schemaPath: ['root'],
          buildOptions: { explain: true },
        };

        const context = normalizeBuildContext(buildInput);

        expect(context.buildId).toBe('custom-build');
        expect(context.builder).toBe(builder);
        expect(context.schemaPath).toEqual(['root']);
        expect(context.buildOptions).toEqual({ explain: true });
      });
    });

    describe('sad', () => {
      it('should keep parent node undefined when parent node is omitted', () => {
        const context = normalizeBuildContext();

        expect(context.parentNode).toBeUndefined();
      });
    });
  });

  describe('isNormalizedRequest()', () => {
    describe('happy', () => {
      it('should return true when normalized flag is true', () => {
        const input = { normalized: true } as SchemaRequestContextInput;

        expect(isNormalizedRequest(input)).toBe(true);
      });
    });

    describe('sad', () => {
      it('should return false when normalized flag is missing', () => {
        expect(isNormalizedRequest({})).toBe(false);
      });
    });
  });

  describe('normalizeRequestContext()', () => {
    describe('happy', () => {
      it('should create normalized context when input is plain request input', () => {
        requestInput = {
          correlationId: 'corr-1',
          metadata: { source: 'test' },
        };

        const context = normalizeRequestContext(requestInput);

        expect(context.normalized).toBe(true);
        expect(context.requestId).toBe('1700000000000-4');
        expect(context.timestamp).toBe(1700000000000);
        expect(context.correlationId).toBe('corr-1');
        expect(context.metadata).toEqual({ source: 'test' });
      });

      it('should return same instance when request is already normalized', () => {
        const state = createState();
        const normalized = normalizeRequestContext({
          normalized: true,
          requestId: 'already-normalized',
          timestamp: 123,
          state,
        });

        const result = normalizeRequestContext(normalized);

        expect(result).toBe(normalized);
      });
    });

    describe('sad', () => {
      it('should create empty metadata when metadata is not provided', () => {
        const context = normalizeRequestContext({});

        expect(context.metadata).toBeUndefined();
      });
    });
  });

  describe('createSchemaContext()', () => {
    describe('happy', () => {
      it('should expose normalized build and request contexts when input is provided', () => {
        const context = createSchemaContext({
          build: { buildId: 'build-1' },
          request: { requestId: 'req-1', timestamp: 11, normalized: true, state: createState() },
        });

        expect(context.getBuildContext()?.buildId).toBe('build-1');
        expect(context.getRequestContext()?.requestId).toBe('req-1');
      });

      it('should keep shared state when replacing request context with different state instance', () => {
        const initialState = createState();
        const nextState = createState();
        const context = createSchemaContext({
          request: {
            normalized: true,
            requestId: 'req-a',
            timestamp: 1,
            state: initialState,
          },
        });

        context.setRequestContext({
          normalized: true,
          requestId: 'req-b',
          timestamp: 2,
          state: nextState,
        });

        expect(context.getRequestContext()?.requestId).toBe('req-b');
        expect(context.getRequestContext()?.state).toBe(initialState);
      });

      it('should update build context when setBuildContext is called', () => {
        const context = createSchemaContext();

        context.setBuildContext(normalizeBuildContext({ buildId: 'updated-build' }));

        expect(context.getBuildContext()?.buildId).toBe('updated-build');
      });
    });

    describe('sad', () => {
      it('should clear request context when setRequestContext receives undefined', () => {
        const context = createSchemaContext({
          request: { requestId: 'req-1', timestamp: 11 },
        });

        context.setRequestContext(undefined);

        expect(context.getRequestContext()).toBeUndefined();
      });
    });
  });
});
