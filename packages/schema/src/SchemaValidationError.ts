import { SchemaIssue, SchemaErrorMeta } from './types.js';

export type SchemaValidationError = Error & {
  issues: readonly SchemaIssue[];
  meta?: SchemaErrorMeta;
};

/**
 * createSchemaValidationError is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const result = createSchemaValidationError(undefined as never);
 */
export const createSchemaValidationError = ({
  issues,
  meta,
}: {
  issues: readonly SchemaIssue[];
  meta?: SchemaErrorMeta;
}): SchemaValidationError => {
  const error = new Error('Schema validation failed') as SchemaValidationError;
  error.issues = issues;
  error.meta = meta;
  return error;
};
