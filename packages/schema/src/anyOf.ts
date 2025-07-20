import { SchemaType } from "./types.js"
import { array } from "./array.js"
import { union } from "./union.js"


export const anyOf = <
  TFirst extends SchemaType<any, any>,
  TSecond extends SchemaType<any, any>,
  TRest extends SchemaType<any, any>[],
  T extends [SchemaType<any, any>, ...SchemaType<any, any>[]],
  TResult extends ReturnType<T[number]>,
>(...types: [TFirst, TSecond, ...TRest]) => {

  if (types.length === 0) {
    throw new Error("No types provided to anyOf");
  } else if (types.length < 2) {
    throw new Error("anyOf requires at least two types to compare against");
  }

  
  return array(union(...types));
}