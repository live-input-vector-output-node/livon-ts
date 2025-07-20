import { Unpromised } from "@livo/types/base.ts";

export type TaggedResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };


const toError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const tryCatchTaggedSync = <T>(
  fn: () => T
): TaggedResult<T> => {
  try {
    const result = fn();
    return { ok: true, data: result };
  } catch (error) {
    return { ok: false, error: toError(error) };
  }
};
