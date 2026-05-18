import { Schema, SchemaContext, SchemaDoc } from './types.js';
import { createSchema, createIssueForPath, ensureSchemaContext, ok, fail } from './schema.js';
import { TypeGuard } from './typeGuards.js';
import { mergeDoc, normalizeDoc } from './doc.js';

export interface SchemaFactoryErrorLike {
  message: string;
  code?: string;
  context?: Readonly<Record<string, unknown>>;
}

export interface SchemaFactoryValidate<T> {
  (input: unknown, ctx: SchemaContext): T;
}

/**
 * Defines one chain operation for a schema value.
 *
 * @typeParam TValue - Current schema output type.
 * @typeParam TArgs - Operation argument tuple.
 * @typeParam TNext - Output type after applying the operation.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 *
 * @example
 * interface MinChain {
 *   (value: number): (min: number) => number;
 * }
 */
export interface SchemaFactoryChainOperation<TValue, TArgs extends readonly unknown[], TNext> {
  (value: TValue, ctx: SchemaContext): (...args: TArgs) => TNext;
}

/**
 * Map of chain operation names to chain operation implementations.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 */
export type SchemaFactoryChainDefinition<TValue> = Record<
  string,
  SchemaFactoryChainOperation<TValue, readonly never[], unknown>
>;

type RuntimeChainOperation<TValue> = SchemaFactoryChainOperation<
  TValue,
  readonly unknown[],
  unknown
>;

interface RunRuntimeChainOperationInput<TValue> {
  operation: SchemaFactoryChainDefinition<TValue>[string];
  value: TValue;
  context: SchemaContext;
  args: readonly unknown[];
}

const runRuntimeChainOperation = <TValue>({
  operation,
  value,
  context,
  args,
}: RunRuntimeChainOperationInput<TValue>): unknown => {
  const runtimeOperation = operation as unknown as RuntimeChainOperation<TValue>;
  return runtimeOperation(value, context)(...args);
};

type SchemaChainMethod<TChain, TOperation> = TOperation extends (
  value: infer _Value,
  ctx: SchemaContext
) => (...args: infer TArgs) => infer TNext
  ? TArgs extends readonly unknown[]
    ? (...args: TArgs) => SchemaWithChain<TNext, TChain>
    : never
  : never;

/**
 * Public chain method surface inferred from a chain definition.
 *
 * Every chain method returns a new schema that keeps the same chain API.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 */
export type SchemaChainMethods<TChain> = {
  [K in keyof TChain]: SchemaChainMethod<TChain, TChain[K]>;
};

/**
 * Schema type enriched with fluent chain methods.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 *
 * @example
 * const Name = string().min(3).max(50);
 */
export type SchemaWithChain<TValue, TChain> = Schema<TValue> &
  SchemaChainMethods<TChain>;

export interface SchemaFactoryInput<TValue, TChain extends SchemaFactoryChainDefinition<TValue>> {
  name: string;
  type: string;
  validate: SchemaFactoryValidate<TValue>;
  ast: (ctx: SchemaContext) => ReturnType<Schema<TValue>['ast']>;
  doc?: SchemaDoc;
  chain?: TChain;
}

export interface SchemaFactory {
  <TValue, TChain extends SchemaFactoryChainDefinition<TValue> = SchemaFactoryChainDefinition<TValue>>(
    input: SchemaFactoryInput<TValue, TChain>,
  ): SchemaWithChain<TValue, TChain>;
}

export interface GuardFactoryInput<T> {
  name: string;
  type: string;
  guard: TypeGuard<T>;
  message: string;
  code?: string;
}

export interface GuardFactory {
  <T>(input: GuardFactoryInput<T>): Schema<T>;
}

interface AttachChainMethodsInput<TValue, TChain extends SchemaFactoryChainDefinition<TValue>> {
  ast: SchemaFactoryInput<TValue, TChain>['ast'];
  base: Schema<TValue>;
  chain: TChain;
  name: string;
  type: string;
}

const normalizeError = (error: unknown): SchemaFactoryErrorLike => {
  if (error && typeof error === 'object' && 'message' in error) {
    const err = error as SchemaFactoryErrorLike;
    return {
      message: err.message,
      code: err.code,
      context: err.context,
    };
  }

  return { message: 'Schema validation failed' };
};

const attachChainMethods = <
  TValue,
  TChain extends SchemaFactoryChainDefinition<TValue> = SchemaFactoryChainDefinition<TValue>,
>({
  ast,
  base,
  chain,
  name,
  type,
}: AttachChainMethodsInput<TValue, TChain>): SchemaWithChain<TValue, TChain> => {
  const result: SchemaWithChain<TValue, TChain> = base as SchemaWithChain<TValue, TChain>;

  Object.entries(chain).forEach(([key, operation]) => {
    (result as Record<string, unknown>)[key] = (...args: readonly unknown[]) =>
      schemaFactory<unknown, SchemaFactoryChainDefinition<unknown>>({
        name: `${name}.${key}`,
        type,
        ast,
        validate: (input, ctx) => {
          const context = ensureSchemaContext(ctx);
          const value = base.parse(input, context);
          const next = runRuntimeChainOperation({ operation, value, context, args });
          return next;
        },
        chain: chain as unknown as SchemaFactoryChainDefinition<unknown>,
      });
  });

  return result;
};

/**
 * schemaFactory is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 *
 * @example
 * const result = schemaFactory(undefined as never);
 */
export const schemaFactory = <
  TValue,
  TChain extends SchemaFactoryChainDefinition<TValue> = SchemaFactoryChainDefinition<TValue>,
>({
  name,
  type,
  validate,
  ast,
  doc,
  chain,
}: SchemaFactoryInput<TValue, TChain>): SchemaWithChain<TValue, TChain> => {
  const docRecord = normalizeDoc(doc);
  const astWithDoc = docRecord
    ? (ctx: SchemaContext) => {
      const node = ast(ctx);
      const merged = mergeDoc(node.doc, docRecord);
      return merged ? { ...node, doc: merged } : node;
    }
    : ast;
  const base = createSchema({
    name,
    type,
    ast: astWithDoc,
    validate: (input, ctx) => {
      const context = ensureSchemaContext(ctx);
      try {
        const value = validate(input, context);
        return ok({ value });
      } catch (error) {
        const normalized = normalizeError(error);
        return fail({
          issues: [
            createIssueForPath({
              path: [],
              message: normalized.message,
              code: normalized.code,
              context: normalized.context,
            }),
          ],
        });
      }
    },
  });

  if (!chain) {
    return base as SchemaWithChain<TValue, TChain>;
  }

  return attachChainMethods({
    ast,
    base,
    chain,
    name,
    type,
  });
};

/**
 * guardFactory is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 *
 * @example
 * const result = guardFactory(undefined as never);
 */
export const guardFactory: GuardFactory = ({ name, type, guard, message, code }) =>
  schemaFactory({
    name,
    type,
    ast: () => ({ type, name }),
    validate: (input) => {
      if (!guard(input)) {
        const error: SchemaFactoryErrorLike = { message, code };
        throw error;
      }
      return input;
    },
  });
