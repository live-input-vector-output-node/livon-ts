import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";
import { SchemaType } from "./types.js"
import { array } from "./array.js"
import { number } from "./number.js";
import { string } from "./string.js";
import { union } from "./union.js"

type DistributeArray<T> = T extends any ? T[] : never;

export const oneOf = <
  TTypes extends [SchemaType<any, any>, ...SchemaType<any, any>[]],
  TResult extends DistributeArray<ReturnType<TTypes[number]>>,
>(...types: TTypes) => {
  if (types.length < 2) {
    throw new Error(`oneOf requires at least two types to compare against received: ${types.length}`);
  }

  const arrays = types.map(type => array(type));

  const alias = createAlias({ union: arrays.map(type => type.alias) });
  return createType(alias, (input): TResult => {
    return union(...arrays as any)(input) as any;
  });
}
