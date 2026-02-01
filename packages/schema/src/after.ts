import { Schema } from './types.js';

export interface AfterInput<T> {
  schema: Schema<T>;
  hook: Parameters<Schema<T>['after']>[0];
}

/**
 * after is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/after
 *
 * @example
 * const result = after(undefined as never);
 */
export const after = <T>({ schema, hook }: AfterInput<T>) => schema.after(hook);
