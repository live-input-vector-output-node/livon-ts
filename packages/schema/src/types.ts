import { Alias, AliasOptions } from "./createAlias.js";
import { TypeContext } from "./createType.js";

export interface SchemaType<T, TArgs extends unknown[] = [input:unknown], TAliasOptions extends AliasOptions = AliasOptions> {
  alias: Alias<TAliasOptions>;
  (...args: TArgs): T;
}