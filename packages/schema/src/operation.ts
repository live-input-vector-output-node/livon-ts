import { Schema, Shape, Infer, SchemaContext, SchemaDoc, PublishAck } from './types.js';
import { createSchemaContext } from './context.js';
import { object } from './object.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- operation input/output schemas require permissive composition typing.
type AnySchema = Schema<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- overload implementation requires broad result type for optional output branches.
type AnyResult = any;

type InputSource = AnySchema | Shape | undefined;
type InputInfer<TInput> = TInput extends AnySchema
  ? Infer<TInput>
  : TInput extends Shape
    ? ShapeInfer<TInput>
    : undefined;

export interface OperationExecutor<TInput, TResult> {
  (input: TInput, ctx: SchemaContext): TResult | Promise<TResult>;
}

export interface OperationRooms<TInput> {
  (input: TInput, ctx: SchemaContext): string | readonly string[] | undefined;
}

export type OperationResult<TOutputSchema extends AnySchema | undefined, TResult> =
  TOutputSchema extends Schema<infer TOutput> ? TOutput : TResult;

export interface OperationPublishHook<TOutput> {
  (output: TOutput, ctx: SchemaContext): unknown | void | Promise<unknown | void>;
}

export type OperationPublishMap<TOutput> = Record<string, OperationPublishHook<TOutput>>;

export type ShapeInfer<TShape extends Shape> = { [K in keyof TShape]: Infer<TShape[K]> };

const isSchema = (value: unknown): value is AnySchema =>
  typeof value === 'object' && value !== null && 'parse' in value && 'ast' in value;

const normalizeDependsOn = (dependsOn: AnySchema | Shape, name?: string): AnySchema =>
  isSchema(dependsOn) ? dependsOn : object({ name: name ?? 'dependsOn', shape: dependsOn });

export interface Operation<
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema | undefined,
  TResult,
> {
  type: 'operation';
  name?: string;
  doc?: SchemaDoc;
  input: TInputSchema;
  output?: TOutputSchema;
  exec: OperationExecutor<Infer<TInputSchema>, TResult>;
  publish?: OperationPublishMap<OperationResult<TOutputSchema, TResult>>;
  rooms?: OperationRooms<Infer<TInputSchema>>;
  ack?: PublishAck;
}

export interface OperationInput<TInputSchema extends AnySchema, TResult> {
  input: TInputSchema;
  doc?: SchemaDoc;
  exec: OperationExecutor<Infer<TInputSchema>, TResult>;
  publish?: OperationPublishMap<TResult>;
  rooms?: OperationRooms<Infer<TInputSchema>>;
  ack?: PublishAck;
}

export interface OperationInputWithOutput<TInputSchema extends AnySchema, TOutputSchema extends AnySchema> {
  input: TInputSchema;
  output: TOutputSchema;
  doc?: SchemaDoc;
  exec: OperationExecutor<Infer<TInputSchema>, Infer<TOutputSchema>>;
  publish?: OperationPublishMap<Infer<TOutputSchema>>;
  rooms?: OperationRooms<Infer<TInputSchema>>;
  ack?: PublishAck;
}

export interface OperationInputWithOptionalOutput<TInputSchema extends AnySchema, TResult>
  extends OperationInput<TInputSchema, TResult> {
  output?: AnySchema;
}

export interface FieldOperationExecutor<TDependsOn, TInput, TResult> {
  (dependsOn: TDependsOn, ctx: SchemaContext): TResult | Promise<TResult>;
  (dependsOn: TDependsOn, input: TInput, ctx: SchemaContext): TResult | Promise<TResult>;
}

export interface FieldOperation<
  TDependsOnSchema extends AnySchema,
  TInput extends InputSource,
  TOutputSchema extends AnySchema | undefined,
  TResult,
> {
  type: 'field';
  name?: string;
  doc?: SchemaDoc;
  dependsOn: TDependsOnSchema;
  input?: AnySchema;
  output?: TOutputSchema;
  exec: FieldOperationExecutor<Infer<TDependsOnSchema>, InputInfer<TInput>, TResult>;
}

export interface FieldOperationInput<TDependsOnSchema extends AnySchema, TResult, TInput extends InputSource = undefined> {
  dependsOn: TDependsOnSchema;
  input?: TInput;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<Infer<TDependsOnSchema>, InputInfer<TInput>, TResult>;
}

export interface FieldOperationInputWithOutput<
  TDependsOnSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TInput extends InputSource = undefined,
> {
  dependsOn: TDependsOnSchema;
  input?: TInput;
  output: TOutputSchema;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<Infer<TDependsOnSchema>, InputInfer<TInput>, Infer<TOutputSchema>>;
}

export interface FieldOperationInputShape<TShape extends Shape, TResult, TInput extends InputSource = undefined> {
  dependsOn: TShape;
  input?: TInput;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<ShapeInfer<TShape>, InputInfer<TInput>, TResult>;
}

export interface FieldOperationInputShapeWithOutput<
  TShape extends Shape,
  TOutputSchema extends AnySchema,
  TInput extends InputSource = undefined,
> {
  dependsOn: TShape;
  input?: TInput;
  output: TOutputSchema;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<ShapeInfer<TShape>, InputInfer<TInput>, Infer<TOutputSchema>>;
}

export interface FieldOperationInputWithOptionalOutput<TDependsOnSchema extends AnySchema, TResult> {
  dependsOn: TDependsOnSchema;
  input?: InputSource;
  output?: AnySchema;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<Infer<TDependsOnSchema>, InputInfer<InputSource>, TResult>;
}

export interface FieldOperationInputShapeWithOptionalOutput<TResult> {
  dependsOn: Shape;
  input?: InputSource;
  output?: AnySchema;
  doc?: SchemaDoc;
  exec: FieldOperationExecutor<ShapeInfer<Shape>, InputInfer<InputSource>, TResult>;
}

export interface OperationWithName<
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema | undefined,
  TResult,
> {
  name: string;
  operation: Operation<TInputSchema, TOutputSchema, TResult>;
}

export interface FieldOperationWithName<
  TDependsOnSchema extends AnySchema,
  TInput extends InputSource,
  TOutputSchema extends AnySchema | undefined,
  TResult,
> {
  name: string;
  operation: FieldOperation<TDependsOnSchema, TInput, TOutputSchema, TResult>;
}

export interface OperationFactory {
  <TInputSchema extends AnySchema, TOutputSchema extends AnySchema>(
    input: OperationInputWithOutput<TInputSchema, TOutputSchema>,
  ): Operation<TInputSchema, TOutputSchema, Infer<TOutputSchema>>;
  <TInputSchema extends AnySchema, TResult>(
    input: OperationInput<TInputSchema, TResult>,
  ): Operation<TInputSchema, undefined, TResult>;
}

/**
 * operation is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = operation(undefined as never);
 */
export function operation<TInputSchema extends AnySchema, TOutputSchema extends AnySchema>(
  input: OperationInputWithOutput<TInputSchema, TOutputSchema>,
): Operation<TInputSchema, TOutputSchema, Infer<TOutputSchema>>;
export function operation<TInputSchema extends AnySchema, TResult>(
  input: OperationInput<TInputSchema, TResult>,
): Operation<TInputSchema, undefined, TResult>;
export function operation<TInputSchema extends AnySchema, TResult>(
  input: OperationInputWithOptionalOutput<TInputSchema, TResult>,
): Operation<TInputSchema, AnySchema | undefined, AnyResult> {
  const output = 'output' in input ? input.output : undefined;
  return {
    type: 'operation' as const,
    input: input.input,
    output,
    exec: input.exec,
    publish: input.publish,
    rooms: input.rooms,
    ack: input.ack,
    doc: input.doc,
  };
}

export interface FieldOperationFactory {
  <TDependsOnSchema extends AnySchema, TOutputSchema extends AnySchema, TInput extends InputSource = undefined>(
    input: FieldOperationInputWithOutput<TDependsOnSchema, TOutputSchema, TInput>,
  ): FieldOperation<TDependsOnSchema, TInput, TOutputSchema, Infer<TOutputSchema>>;
  <TDependsOnSchema extends AnySchema, TResult, TInput extends InputSource = undefined>(
    input: FieldOperationInput<TDependsOnSchema, TResult, TInput>,
  ): FieldOperation<TDependsOnSchema, TInput, undefined, TResult>;
  <TShape extends Shape, TOutputSchema extends AnySchema, TInput extends InputSource = undefined>(
    input: FieldOperationInputShapeWithOutput<TShape, TOutputSchema, TInput>,
  ): FieldOperation<AnySchema, TInput, TOutputSchema, Infer<TOutputSchema>>;
  <TShape extends Shape, TResult, TInput extends InputSource = undefined>(
    input: FieldOperationInputShape<TShape, TResult, TInput>,
  ): FieldOperation<AnySchema, TInput, undefined, TResult>;
}

/**
 * fieldOperation is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = fieldOperation(undefined as never);
 */
export function fieldOperation<
  TDependsOnSchema extends AnySchema,
  TOutputSchema extends AnySchema,
  TInput extends InputSource = undefined,
>(
  input: FieldOperationInputWithOutput<TDependsOnSchema, TOutputSchema, TInput>,
): FieldOperation<TDependsOnSchema, TInput, TOutputSchema, Infer<TOutputSchema>>;
export function fieldOperation<
  TDependsOnSchema extends AnySchema,
  TResult,
  TInput extends InputSource = undefined,
>(
  input: FieldOperationInput<TDependsOnSchema, TResult, TInput>,
): FieldOperation<TDependsOnSchema, TInput, undefined, TResult>;
export function fieldOperation<
  TShape extends Shape,
  TOutputSchema extends AnySchema,
  TInput extends InputSource = undefined,
>(
  input: FieldOperationInputShapeWithOutput<TShape, TOutputSchema, TInput>,
): FieldOperation<AnySchema, TInput, TOutputSchema, Infer<TOutputSchema>>;
export function fieldOperation<
  TShape extends Shape,
  TResult,
  TInput extends InputSource = undefined,
>(
  input: FieldOperationInputShape<TShape, TResult, TInput>,
): FieldOperation<AnySchema, TInput, undefined, TResult>;
export function fieldOperation<TDependsOnSchema extends AnySchema, TResult>(
  input:
    | FieldOperationInput<TDependsOnSchema, TResult, InputSource>
    | FieldOperationInputShape<Shape, TResult, InputSource>
    | FieldOperationInputWithOutput<TDependsOnSchema, AnySchema, InputSource>
    | FieldOperationInputShapeWithOutput<Shape, AnySchema, InputSource>
    | FieldOperationInputWithOptionalOutput<TDependsOnSchema, TResult>
    | FieldOperationInputShapeWithOptionalOutput<TResult>,
): FieldOperation<AnySchema, InputSource, AnySchema | undefined, AnyResult> {
  const dependsOnSchema = normalizeDependsOn(input.dependsOn, 'dependsOn');
  const inputSchema = input.input
    ? normalizeDependsOn(input.input as AnySchema | Shape, 'input')
    : undefined;
  const output = 'output' in input ? input.output : undefined;
  return {
    type: 'field' as const,
    dependsOn: dependsOnSchema,
    input: inputSchema,
    output,
    exec: input.exec,
    doc: input.doc,
  };
}

/**
 * withOperationName is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = withOperationName(undefined as never);
 */
export const withOperationName = <
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema | undefined,
  TResult,
>({
  name,
  operation: op,
}: OperationWithName<TInputSchema, TOutputSchema, TResult>): Operation<TInputSchema, TOutputSchema, TResult> => ({
  ...op,
  name,
});

/**
 * withFieldOperationName is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = withFieldOperationName(undefined as never);
 */
export const withFieldOperationName = <
  TDependsOnSchema extends AnySchema,
  TInput extends InputSource,
  TOutputSchema extends AnySchema | undefined,
  TResult,
>({
  name,
  operation: op,
}: FieldOperationWithName<TDependsOnSchema, TInput, TOutputSchema, TResult>): FieldOperation<
  TDependsOnSchema,
  TInput,
  TOutputSchema,
  TResult
> => ({
  ...op,
  name,
});

const logPublishError = (error: unknown, info?: Readonly<Record<string, unknown>>, ctx?: SchemaContext) => {
  try {
    const logger = ctx?.request?.logger ?? ctx?.getRequestContext()?.logger;
    if (logger?.error) {
      logger.error('publish failed', info, error);
      return;
    }
    // eslint-disable-next-line no-console
    (globalThis as { console?: { error?: (...args: unknown[]) => void } }).console?.error?.(
      'publish failed',
      info ?? {},
      error,
    );
  } catch {}
};

const runPublishHooks = async <TOutput>(
  publish: OperationPublishMap<TOutput> | undefined,
  output: TOutput,
  ctx: SchemaContext,
  rooms?: string | readonly string[],
  operationInput?: unknown,
  ack?: PublishAck,
) => {
  if (!publish) {
    return;
  }
  const publisher = ctx.request?.publisher ?? ctx.getRequestContext()?.publisher;
  if (!publisher) {
    return;
  }
  const roomList = Array.isArray(rooms) ? rooms : rooms ? [rooms] : [];
  await Object.entries(publish).reduce<Promise<void>>(async (pending, [topic, hook]) => {
    await pending;
    try {
      const payload = await hook(output, ctx);
      if (payload === undefined) {
        return;
      }
      if (roomList.length === 0) {
        await publisher({ topic, payload, input: operationInput, ack });
        return;
      }
      await roomList.reduce<Promise<void>>(async (chain, room) => {
        await chain;
        await publisher({ topic, payload, input: operationInput, ack, meta: { room } });
      }, Promise.resolve());
    } catch (error) {
      logPublishError(error, { topic, phase: 'publish-hook' }, ctx);
      ctx.request?.onPublishError?.(error, { topic, phase: 'publish-hook' });
    }
  }, Promise.resolve());
};

const wrapPublisher = (ctx: SchemaContext) => {
  const request = ctx.request ?? ctx.getRequestContext();
  if (!request?.publisher) {
    return;
  }
  const original = request.publisher;
  request.publisher = async (input) => {
    try {
      await original(input);
    } catch (error) {
      logPublishError(error, { topic: input.topic, phase: 'publisher' }, ctx);
      request.onPublishError?.(error, { topic: input.topic, phase: 'publisher' });
    }
  };
};

/**
 * runOperation is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = runOperation(undefined as never);
 */
export const runOperation = async <
  TInputSchema extends AnySchema,
  TOutputSchema extends AnySchema | undefined,
  TResult,
>(
  op: Operation<TInputSchema, TOutputSchema, TResult>,
  rawInput: unknown,
  ctx?: SchemaContext,
): Promise<OperationResult<TOutputSchema, TResult>> => {
  const context = ctx ?? createSchemaContext();
  if (!context.getRequestContext()) {
    context.setRequestContext({});
  }
  wrapPublisher(context);
  const input = op.input.parse(rawInput, context) as Infer<TInputSchema>;
  const rooms = op.rooms ? op.rooms(input, context) : undefined;
  const result = await op.exec(input, context);
  const output = op.output
    ? (op.output.parse(result, context) as OperationResult<TOutputSchema, TResult>)
    : (result as OperationResult<TOutputSchema, TResult>);
  await runPublishHooks(op.publish, output, context, rooms, input, op.ack);
  return output;
};

/**
 * runFieldOperation is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see https://livon.tech/docs/schema/operation
 *
 * @example
 * const result = runFieldOperation(undefined as never);
 */
export const runFieldOperation = async <
  TDependsOnSchema extends AnySchema,
  TInput extends InputSource,
  TOutputSchema extends AnySchema | undefined,
  TResult,
>(
  op: FieldOperation<TDependsOnSchema, TInput, TOutputSchema, TResult>,
  rawDependsOn: unknown,
  rawInputOrContext?: unknown,
  ctx?: SchemaContext,
): Promise<OperationResult<TOutputSchema, TResult>> => {
  const isContext = (value: unknown): value is SchemaContext =>
    typeof value === 'object' &&
    value !== null &&
    'getBuildContext' in value &&
    'getRequestContext' in value;

  const actualContext = isContext(rawInputOrContext) ? rawInputOrContext : ctx;
  const rawInput = isContext(rawInputOrContext) ? undefined : rawInputOrContext;
  const context = actualContext ?? createSchemaContext();
  if (!context.getRequestContext()) {
    context.setRequestContext({});
  }
  const dependsOn = op.dependsOn.parse(rawDependsOn, context) as Infer<TDependsOnSchema>;
  const input = op.input ? op.input.parse(rawInput, context) : undefined;
  const result = op.input
    ? await op.exec(dependsOn, input as InputInfer<TInput>, context)
    : await op.exec(dependsOn, context);
  if (op.output) {
    return op.output.parse(result, context) as OperationResult<TOutputSchema, TResult>;
  }
  return result as OperationResult<TOutputSchema, TResult>;
};
