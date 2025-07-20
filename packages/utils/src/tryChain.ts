// ./composeTry.ts
import { tryCatchTagged, TaggedResult } from './tryCatchTagged.js';

// Hilfstypen
export type SyncOrAsync<T> = T | Promise<T>;
export type Step<I, O> = (input: I) => SyncOrAsync<O>;
export type AwaitedResult<T> = T extends Promise<infer U> ? U : T;
export type IsAsync<T> = T extends Promise<any> ? true : false;

// Haupttyp: ComposeTry
export type ComposeTry<TValue, Async extends boolean> = {
  try: <R,>(step: (input: TValue) => SyncOrAsync<R>) =>
    ComposeTry<AwaitedResult<R>, Async extends true ? true : IsAsync<R>>;

  withLabel: (label: string) => ComposeTry<TValue, Async> & { label: string };
  withMeta: <M>(meta: M) => ComposeTry<TValue, Async> & { meta: M };

  execute: Async extends true
    ? () => Promise<TaggedResult<TValue>>
    : () => TaggedResult<TValue>;

  label?: string;
  meta?: unknown;
};

export const tryChain = <T,>(
  initial: () => SyncOrAsync<T>
): ComposeTry<AwaitedResult<T>, IsAsync<T>> => {
  const chain: Step<any, any>[] = [];
  let labelValue: string | undefined;
  let metaValue: unknown;

  const execute = () => {
    let result: SyncOrAsync<any>;

    try {
      result = initial();
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
    }

    const runSync = (val: unknown): TaggedResult<unknown> => {
      try {
        for (const fn of chain) val = fn(val);
        return { ok: true, data: val };
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
      }
    };

    if (result instanceof Promise) {
      return result
        .then(async (val) => {
          for (const fn of chain) val = await fn(val);
          return { ok: true, data: val };
        })
        .catch((err) => ({ ok: false, error: err instanceof Error ? err : new Error(String(err)) }));
    }

    if (chain.some((fn) => String(fn).includes('async'))) {
      return (async () => {
        try {
          let val = result;
          for (const fn of chain) val = await fn(val);
          return { ok: true, data: val };
        } catch (err) {
          return { ok: false, error: err instanceof Error ? err : new Error(String(err)) };
        }
      })();
    }

    return runSync(result);
  };

  const wrapperFactory = <Current, NextAsync extends boolean>(
    _step: Step<any, Current>
  ): ComposeTry<AwaitedResult<Current>, NextAsync> => {
    const typedTry = <R,>(step: (input: AwaitedResult<Current>) => SyncOrAsync<R>): ComposeTry<AwaitedResult<R>, NextAsync extends true ? true : IsAsync<R>> => {
      chain.push(step);
      return wrapperFactory(step) as ComposeTry<AwaitedResult<R>, NextAsync extends true ? true : IsAsync<R>>;
    };

    const withLabel = (label: string): ComposeTry<AwaitedResult<Current>, NextAsync> & { label: string } => {
      labelValue = label;
      const wrapped = wrapperFactory(_step) as ComposeTry<AwaitedResult<Current>, NextAsync> & { label: string };
      wrapped.label = label;
      return wrapped;
    };

    const withMeta = <M>(meta: M): ComposeTry<AwaitedResult<Current>, NextAsync> & { meta: M } => {
      metaValue = meta;
      const wrapped = wrapperFactory(_step) as ComposeTry<AwaitedResult<Current>, NextAsync> & { meta: M };
      wrapped.meta = meta;
      return wrapped;
    };

    return {
      try: typedTry,
      withLabel,
      withMeta,
      execute: execute as ComposeTry<AwaitedResult<Current>, NextAsync>['execute'],
      label: labelValue,
      meta: metaValue
    };
  };

  return wrapperFactory(initial);
};

