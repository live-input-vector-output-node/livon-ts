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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chain argument/return tuples vary per key and are inferred by SchemaChainMethods.
  SchemaFactoryChainOperation<TValue, readonly any[], any>
>;

/**
 * Public chain method surface inferred from a chain definition.
 *
 * Every chain method returns a new schema that keeps the same chain API.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- helper conditional type must accept heterogeneous chain signatures.
export type SchemaChainMethods<TChain extends SchemaFactoryChainDefinition<any>> = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- each method infers args/next type from its chain entry.
  [K in keyof TChain]: TChain[K] extends SchemaFactoryChainOperation<any, infer TArgs, infer TNext>
    ? (...args: TArgs) => SchemaWithChain<TNext, TChain>
    : never;
};

/**
 * Schema type enriched with fluent chain methods.
 *
 * @see https://livon.tech/docs/schema/schema-factory
 *
 * @example
 * const Name = string().min(3).max(50);
 */
export type SchemaWithChain<TValue, TChain extends SchemaFactoryChainDefinition<TValue>> = Schema<TValue> &
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

  const result: SchemaWithChain<TValue, TChain> = base as SchemaWithChain<TValue, TChain>;

  if (!chain) {
    return result;
  }

  Object.entries(chain).forEach(([key, operation]) => {
    (result as Record<string, unknown>)[key] = (...args: readonly unknown[]) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- runtime dispatch cannot preserve per-key generic output without erased bridge type.
      schemaFactory<any, TChain>({
        name: `${name}.${key}`,
        type,
        ast,
        validate: (input, ctx) => {
          const context = ensureSchemaContext(ctx);
          const value = base.parse(input, context);
          const next = operation(value, context)(...args);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- chain output type is recovered on the public API surface via SchemaChainMethods.
          return next as any;
        },
        chain: chain as TChain,
      });
  });

  return result;
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
