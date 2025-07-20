import type { AnyConstructor, AnyFunction } from '@livo/types/base.ts';
import { tryCatchTagged } from './tryCatchTagged.js'
import { isAnyFunction } from './isAnyFuntion.js';

export const resolveTypeOrFn = async <
  TTypeOrFn extends AnyConstructor<any, any[]>,
  TArgs extends (TTypeOrFn extends AnyFunction ? Parameters<TTypeOrFn> : []),
  TReturn extends TTypeOrFn extends AnyFunction ? ReturnType<TTypeOrFn> : TTypeOrFn,
>(typeOrFn: TTypeOrFn, ...args: TArgs) => {
  const result = await tryCatchTagged(() => {
    if (isAnyFunction(typeOrFn)) {
      return typeOrFn(...args);
    }
    return typeOrFn as unknown as TReturn;
  });
  if (result.ok) {
    return result.data as unknown as TReturn;
  }
  throw result.error;
}