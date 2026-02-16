import {
  Schema,
  SchemaContext,
  SchemaIssue,
  SchemaResult,
  SchemaErrorMeta,
  SchemaHookBefore,
  SchemaHookAfter,
  SchemaValidate,
  SchemaRefineInput,
  SchemaAndOptions,
  AstNode,
  SchemaDoc,
} from './types.js';
import { createSchemaValidationError } from './SchemaValidationError.js';
import { normalizeBuildContext, normalizeRequestContext, createSchemaContext } from './context.js';
import { TypeGuard } from './typeGuards.js';
import { mergeDoc, normalizeDoc } from './doc.js';

export interface CreateIssueInput {
  path: readonly (string | number)[];
  message: string;
  code?: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface OkInput<T> {
  value: T;
}

export interface FailInput {
  issues: readonly SchemaIssue[];
  meta?: SchemaErrorMeta;
}

export interface SchemaAstInternal {
  (ctx: SchemaContext): AstNode;
}

export interface CreateSchemaInput<T> {
  name: string;
  type: string;
  ast: SchemaAstInternal;
  validate: SchemaValidate<T>;
}

export interface CreateGuardSchemaInput<T> {
  name: string;
  type: string;
  guard: TypeGuard<T>;
  message: string;
  code?: string;
}

export interface SchemaGuard<T> {
  (input: unknown): input is T;
}

export interface CreatePrimitiveSchemaInput<T> {
  name: string;
  type: string;
  guard: SchemaGuard<T>;
  message: string;
  code?: string;
}

export interface EnsureSchemaContextInput {
  context?: SchemaContext;
  request?: SchemaContext['getRequestContext'];
}

export interface EnsureSchemaContext {
  (ctx?: SchemaContext): SchemaContext;
}

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === 'object' && input !== null && !Array.isArray(input);

const capitalize = (input: string): string =>
  input.length === 0 ? input : `${input.slice(0, 1).toUpperCase()}${input.slice(1)}`;

const joinAndSchemaName = (leftName: string, rightName: string): string => `${leftName}${capitalize(rightName)}`;

const mergeAndValue = <T, U>(leftValue: T, rightValue: U): T & U =>
  isRecord(leftValue) && isRecord(rightValue)
    ? ({ ...leftValue, ...rightValue } as T & U)
    : (leftValue as T & U);

/**
 * createIssueForPath is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = createIssueForPath(undefined as never);
 */
export const createIssueForPath = ({
  path,
  message,
  code,
  context,
}: CreateIssueInput): SchemaIssue => ({
  path,
  message,
  code,
  context,
});

/**
 * ok is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = ok(undefined as never);
 */
export const ok = <T>({ value }: OkInput<T>): SchemaResult<T> => ({ ok: true, value });

/**
 * fail is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = fail(undefined as never);
 */
export const fail = ({ issues, meta }: FailInput): SchemaResult<never> => ({ ok: false, issues, meta });

/**
 * ensureSchemaContext is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = ensureSchemaContext(undefined as never);
 */
export const ensureSchemaContext: EnsureSchemaContext = (ctx) => {
  if (ctx) {
    return ctx;
  }
  const request = normalizeRequestContext();
  return createSchemaContext({ request });
};

/**
 * createSchema is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = createSchema(undefined as never);
 */
export const createSchema = <T>({ name, type, ast, validate }: CreateSchemaInput<T>): Schema<T> => {
  const validateWithContext = (input: unknown, ctx?: SchemaContext): SchemaResult<T> => {
    const context = ensureSchemaContext(ctx);
    if (!context.getRequestContext()) {
      context.setRequestContext(normalizeRequestContext());
    }
    const build = context.getBuildContext();
    const request = context.getRequestContext();
    const meta: SchemaErrorMeta = { build, request, type, name };
    const result = validate(input, context);
    return result.ok ? result : fail({ issues: result.issues, meta });
  };

  const parse = (input: unknown, ctx?: SchemaContext): T => {
    const result = validateWithContext(input, ctx);
    if (result.ok) {
      return result.value;
    }
    throw createSchemaValidationError({ issues: result.issues, meta: result.meta });
  };

  const typed = (input: unknown, ctx?: SchemaContext): T => parse(input, ctx);

  const optional = (): Schema<T | undefined> =>
    createSchema<T | undefined>({
      name: `${name}.optional`,
      type: `${type}.optional`,
      ast,
      validate: (input, ctx) => (input === undefined ? ok({ value: undefined }) : validate(input, ctx)),
    });

  const nullable = (): Schema<T | null> =>
    createSchema<T | null>({
      name: `${name}.nullable`,
      type: `${type}.nullable`,
      ast,
      validate: (input, ctx) => (input === null ? ok({ value: null }) : validate(input, ctx)),
    });

  const describe = (doc: SchemaDoc): Schema<T> => {
    const nextDoc = normalizeDoc(doc);
    return createSchema({
      name,
      type,
      ast: (ctx) => {
        const node = ast(ctx);
        const merged = mergeDoc(node.doc, nextDoc);
        return merged ? { ...node, doc: merged } : node;
      },
      validate,
    });
  };

  const refine = ({ predicate, message, code }: SchemaRefineInput<T>): Schema<T> =>
    createSchema({
      name: `${name}.refine`,
      type: `${type}.refine`,
      ast,
      validate: (input, ctx) => {
        const context = ensureSchemaContext(ctx);
        const result = validate(input, context);
        if (!result.ok) {
          return result;
        }
        return predicate(result.value, context)
          ? result
          : fail({ issues: [createIssueForPath({ path: [], message, code })] });
      },
    });

  const before = (hook: SchemaHookBefore): Schema<T> =>
    createSchema({
      name: `${name}.before`,
      type: `${type}.before`,
      ast,
      validate: (input, ctx) => {
        const context = ensureSchemaContext(ctx);
        const result = hook(input, context);
        const issues =
          typeof result === 'object' && result !== null && 'issues' in result
            ? ((result as { issues?: readonly SchemaIssue[] }).issues ?? [])
            : [];
        if (issues.length > 0) {
          return fail({ issues });
        }
        const nextInput =
          typeof result === 'object' && result !== null && 'input' in result
            ? (result as { input: unknown }).input
            : result;
        return validate(nextInput, context);
      },
    });

  const after = <U>(hook: SchemaHookAfter<T, U>): Schema<U> =>
    createSchema({
      name: `${name}.after`,
      type: `${type}.after`,
      ast,
      validate: (input, ctx) => {
        const context = ensureSchemaContext(ctx);
        const result = validate(input, context);
        if (!result.ok) {
          return result;
        }
        const hookResult = hook(result.value, context);
        const issues =
          typeof hookResult === 'object' && hookResult !== null && 'issues' in hookResult
            ? ((hookResult as { issues?: readonly SchemaIssue[] }).issues ?? [])
            : [];
        if (issues.length > 0) {
          return fail({ issues });
        }
        const nextValue =
          typeof hookResult === 'object' && hookResult !== null && 'value' in hookResult
            ? (hookResult as { value: U }).value
            : (hookResult as U);
        return ok({ value: nextValue });
      },
    });

  const and = <U>(other: Schema<U>, options?: SchemaAndOptions): Schema<T & U> =>
    createSchema({
      name: options?.name ?? joinAndSchemaName(name, other.name),
      type: `${type}.and`,
      ast: (ctx) => ({
        type: 'and',
        children: [ast(ctx), other.ast(ctx.getBuildContext())],
      }),
      validate: (input, ctx) => {
        const context = ensureSchemaContext(ctx);
        const left = validate(input, context);
        const right = other.validate(input, context);
        return left.ok && right.ok
          ? ok({ value: mergeAndValue(left.value, right.value) })
          : fail({ issues: [...(left.ok ? [] : left.issues), ...(right.ok ? [] : right.issues)] });
      },
    });

  const resolveAst = (ctx: SchemaContext): AstNode => {
    const node = ast(ctx);
    return node.name ? node : { ...node, name };
  };

  return {
    name,
    type,
    ast: (input) => {
      const build = normalizeBuildContext(input ?? {});
      const context = createSchemaContext({ build });
      return resolveAst(context);
    },
    validate: validateWithContext,
    parse,
    typed,
    optional,
    nullable,
    describe,
    refine,
    before,
    after,
    and,
  };
};

/**
 * createGuardSchema is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = createGuardSchema(undefined as never);
 */
export const createGuardSchema = <T>({ name, type, guard, message, code }: CreateGuardSchemaInput<T>) =>
  createSchema<T>({
    name,
    type,
    ast: () => ({ type, constraints: { kind: 'guard' } }),
    validate: (input) =>
      guard(input)
        ? ok({ value: input })
        : fail({ issues: [createIssueForPath({ path: [], message, code })] }),
  });

/**
 * createPrimitiveSchema is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = createPrimitiveSchema(undefined as never);
 */
export const createPrimitiveSchema = <T>({
  name,
  type,
  guard,
  message,
  code,
}: CreatePrimitiveSchemaInput<T>) =>
  createSchema<T>({
    name,
    type,
    ast: () => ({ type, constraints: { kind: 'primitive' } }),
    validate: (input) =>
      guard(input)
        ? ok({ value: input })
        : fail({ issues: [createIssueForPath({ path: [], message, code })] }),
  });
