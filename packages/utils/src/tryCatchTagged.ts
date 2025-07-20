import { Unpromised } from "@livon/types/base.ts";
import { tryCatchTaggedSync } from "./tryCatchTaggedSync.js";

export type TaggedResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };


const toError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const tryCatchTagged = async <T, TResult extends TaggedResult<Awaited<T>>>(
  fn: () => T
): Promise<TResult> => {
  try {
    const result = tryCatchTaggedSync(fn);
    if (result.ok) {
      return { ok: true, data: await result.data } as TResult
    }
    return { ok: false, error: result.error } as TResult;
  } catch (error) {
    return { ok: false, error: toError(error) } as TResult;
  }
};
