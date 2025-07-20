import { AnyFunction, AnyConstructor } from "@livo/types/base.ts";

export const isAnyFunction = (typeOrFn: AnyConstructor<any, any[]>): typeOrFn is AnyFunction => {
  return typeof typeOrFn === 'function';
}