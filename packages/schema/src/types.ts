export type SchemaPath = readonly (string | number)[];

export type SchemaIssue = {
  path: SchemaPath;
  message: string;
  code?: string;
  context?: Readonly<Record<string, unknown>>;
};

export type SchemaResultOk<T> = { ok: true; value: T };
export type SchemaResultFail = { ok: false; issues: readonly SchemaIssue[]; meta?: SchemaErrorMeta };
export type SchemaResult<T> = SchemaResultOk<T> | SchemaResultFail;

export type SchemaErrorMeta = {
  request?: SchemaRequestContext;
  build?: SchemaBuildContext;
  type?: string;
  name?: string;
};

export interface AstNode {
  type: string;
  name?: string;
  doc?: Readonly<Record<string, unknown>>;
  request?: string;
  response?: string;
  dependsOn?: string;
  constraints?: Readonly<Record<string, unknown>>;
  children?: readonly AstNode[];
}

export type SchemaDoc = string | Readonly<Record<string, unknown>>;

export interface AstBuilderAdd {
  (node: AstNode): AstNode;
}

export interface AstBuilderGetAll {
  (): readonly AstNode[];
}

export interface AstBuilder {
  add: AstBuilderAdd;
  getAll: AstBuilderGetAll;
}

export interface SchemaBuildContext {
  buildId: string;
  builder: AstBuilder;
  parentNode?: AstNode;
  schemaPath: readonly string[];
  buildOptions: Readonly<Record<string, unknown>>;
}

export type SchemaBuildContextInput = Partial<SchemaBuildContext>;

export interface SchemaStateGet {
  <T = unknown>(key: string): T | undefined;
}

export interface SchemaStateSet {
  <T = unknown>(key: string, value: T): void;
}

export interface SchemaStateUpdater<T> {
  (current: T | undefined): T;
}

export interface SchemaStateUpdate {
  <T = unknown>(key: string, updater: SchemaStateUpdater<T>): void;
}

export interface SchemaStateSnapshot {
  (): Readonly<Record<string, unknown>>;
}

export interface SchemaState {
  get: SchemaStateGet;
  set: SchemaStateSet;
  update: SchemaStateUpdate;
  snapshot: SchemaStateSnapshot;
}

export type AckMode = 'received' | 'handled';

export interface AckConfig {
  required?: boolean;
  mode?: AckMode;
  timeoutMs?: number;
  retries?: number;
}

export type PublishAck = boolean | AckConfig;

export type PublishInput = {
  topic: string;
  payload: unknown;
  input?: unknown;
  ack?: PublishAck;
  key?: string;
  meta?: Readonly<Record<string, unknown>>;
};

export interface Publisher {
  (input: PublishInput): void | Promise<void>;
}

export interface Logger {
  error?: (message: string, info?: Readonly<Record<string, unknown>>, error?: unknown) => void;
  warn?: (message: string, info?: Readonly<Record<string, unknown>>) => void;
  info?: (message: string, info?: Readonly<Record<string, unknown>>) => void;
  debug?: (message: string, info?: Readonly<Record<string, unknown>>) => void;
}

export interface PublishErrorHandler {
  (error: unknown, info?: Readonly<Record<string, unknown>>): void;
}

export interface SchemaRequestContext {
  requestId: string;
  timestamp: number;
  correlationId?: string;
  sourceId?: string;
  userId?: string;
  tenantId?: string;
  metadata?: Readonly<Record<string, unknown>>;
  normalized?: true;
  state: SchemaState;
  publisher?: Publisher;
  onPublishError?: PublishErrorHandler;
  logger?: Logger;
}

export type SchemaRequestContextInput =
  | Partial<Omit<SchemaRequestContext, 'normalized' | 'state'>>
  | SchemaRequestContext;

export interface SchemaContextGetBuild {
  (): SchemaBuildContext | undefined;
}

export interface SchemaContextSetBuild {
  (ctx?: SchemaBuildContext): void;
}

export interface SchemaContextGetRequest {
  (): SchemaRequestContext | undefined;
}

export interface SchemaContextSetRequest {
  (ctx?: SchemaRequestContextInput): void;
}

export interface SchemaContext {
  getBuildContext: SchemaContextGetBuild;
  setBuildContext: SchemaContextSetBuild;
  getRequestContext: SchemaContextGetRequest;
  setRequestContext: SchemaContextSetRequest;
  request?: SchemaRequestContext;
  state: SchemaState;
}

export interface SchemaParse<T> {
  (input: unknown, ctx?: SchemaContext): T;
}

export interface SchemaValidate<T> {
  (input: unknown, ctx?: SchemaContext): SchemaResult<T>;
}

export interface SchemaTyped<T> {
  (input: T, ctx?: SchemaContext): T;
}

export interface SchemaAst {
  (input?: SchemaBuildContextInput): AstNode;
}

export interface SchemaRefine<T> {
  (value: T, ctx: SchemaContext): boolean;
}

export interface SchemaRefineInput<T> {
  predicate: SchemaRefine<T>;
  message: string;
  code?: string;
}

export type SchemaHookBeforeResult =
  | unknown
  | { input: unknown }
  | { issues: readonly SchemaIssue[] }
  | { input: unknown; issues: readonly SchemaIssue[] };

export type SchemaHookAfterResult<U> =
  | U
  | { value: U }
  | { issues: readonly SchemaIssue[] }
  | { value: U; issues: readonly SchemaIssue[] };

export interface SchemaHookBefore {
  (input: unknown, ctx: SchemaContext): SchemaHookBeforeResult;
}

export interface SchemaHookAfter<T, U> {
  (value: T, ctx: SchemaContext): SchemaHookAfterResult<U>;
}

/**
 * Adds `undefined` as an accepted value for the current schema.
 *
 * @returns A schema that accepts the original type or `undefined`.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const MaybeName = string().optional();
 */
export interface SchemaOptional<T> {
  (): Schema<T | undefined>;
}

/**
 * Adds `null` as an accepted value for the current schema.
 *
 * @returns A schema that accepts the original type or `null`.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const NullableName = string().nullable();
 */
export interface SchemaNullable<T> {
  (): Schema<T | null>;
}

/**
 * Adds an additional predicate-based validation step.
 *
 * @param input - Predicate and error metadata.
 * @returns A schema with the extra refinement rule.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const Adult = number().refine({
 *   predicate: (value) => value >= 18,
 *   message: 'Must be at least 18',
 * });
 */
export interface SchemaRefineMethod<T> {
  (input: SchemaRefineInput<T>): Schema<T>;
}

/**
 * Runs a preprocessing hook before base validation.
 *
 * @param hook - Hook that can transform input and/or emit issues.
 * @returns A schema with the before-hook applied.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const Trimmed = string().before((input) =>
 *   typeof input === 'string' ? input.trim() : input
 * );
 */
export interface SchemaBeforeMethod<T> {
  (hook: SchemaHookBefore): Schema<T>;
}

/**
 * Runs a postprocessing hook after successful validation.
 *
 * @param hook - Hook that maps validated value to a new value.
 * @returns A schema of the transformed output type.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const UserId = string().after((value) => value.toUpperCase());
 */
export interface SchemaAfterMethod<T> {
  <U>(hook: SchemaHookAfter<T, U>): Schema<U>;
}

export interface SchemaAndOptions {
  name?: string;
}

/**
 * Creates an intersection schema with another schema.
 *
 * @param other - Schema to intersect with.
 * @param options - Optional naming override for the composed schema.
 * @returns A schema that must satisfy both schemas.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const Combined = LeftSchema.and(RightSchema);
 */
export interface SchemaAndMethod<T> {
  <U>(other: Schema<U>, options?: SchemaAndOptions): Schema<T & U>;
}

/**
 * Attaches documentation metadata to the schema AST node.
 *
 * @param doc - Documentation text or structured metadata.
 * @returns A schema with merged documentation metadata.
 * @see https://live-input-vector-output-node.github.io/livon-ts/docs/schema/type-safety
 *
 * @example
 * const Email = string().describe('User e-mail address');
 */
export interface SchemaDescribeMethod<T> {
  (doc: SchemaDoc): Schema<T>;
}

export interface Schema<T> {
  name: string;
  type: string;
  ast: SchemaAst;
  validate: SchemaValidate<T>;
  parse: SchemaParse<T>;
  typed: SchemaTyped<T>;
  optional: SchemaOptional<T>;
  nullable: SchemaNullable<T>;
  describe: SchemaDescribeMethod<T>;
  refine: SchemaRefineMethod<T>;
  before: SchemaBeforeMethod<T>;
  after: SchemaAfterMethod<T>;
  and: SchemaAndMethod<T>;
}

export type Shape = Readonly<Record<string, Schema<unknown>>>;

export type Infer<TSchema> = TSchema extends Schema<infer TValue> ? TValue : never;
