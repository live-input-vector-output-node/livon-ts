import { AnyFunction, AnyConstructor } from "@livon/types/base.ts";

export const isAnyFunction = (typeOrFn: AnyConstructor<any, any[]>): typeOrFn is AnyFunction => {
  return typeof typeOrFn === 'function';
}