import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

export const union = <
  TTypes extends [SchemaType<any, any>, SchemaType<any, any>, ...SchemaType<any, any>[]],
  TReturn extends ReturnType<TTypes[number]>,
>(...types: TTypes) => createType({ union: types.map(type => type.alias) }, (input): SchemaType<TReturn> => {
  if (types.length < 2) {
    throw new Error(`Union requires at least two types, but received only one`);
  }

  const initial = Symbol('initial');
  const errors: any[] = [];
  const parsed = types.reduce<TReturn | typeof initial>((acc, type) => {
    try {
      return acc || type(input);
    } catch (e) {
      errors.push(e);
      return acc;
    }
  }, initial);

  if (parsed === initial) {
    throw new Error(`Input does not match any of the provided types: ${JSON.stringify(input)}`, { cause: errors });
  }

  return parsed;
});
