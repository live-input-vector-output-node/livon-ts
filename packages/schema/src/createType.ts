import { AliasOptions, createAlias } from "./createAlias.js";
import { SchemaType } from "./types.js";



export const typeIdentifier = Symbol("SchemaType");

export interface TypeContext {
  groups: [];
}

export const createType = <T, U extends unknown[] | [T] = [unknown] | [T]>(aliasOptions: AliasOptions, exec: (...args: U) => T): SchemaType<T, U, typeof aliasOptions> & typeof exec => {
  const alias = createAlias(aliasOptions);
  return Object.assign(exec, { [typeIdentifier]: true as const, alias });
}