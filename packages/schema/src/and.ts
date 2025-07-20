import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

type UnionToIntersection<U> = (
  U extends any ? (x: U) => void : never
) extends (x: infer I) => void ? I : never;

export const and = <
  TTypes extends [SchemaType<{}, any>, ...SchemaType<{}, any>[]],
  TResult = UnionToIntersection<ReturnType<TTypes[number]>>,
>(
  name: string,
  ...types: TTypes
) => {
  return createType({ name, and: types.map(type => type.alias) }, (input): TResult => {

    const errors: any[] = []

    const initial = Symbol('inital');

    const parsed = types.reduce<unknown>((acc, type) => {
      try {
        if (acc === initial) {
          return type(input);
        }
        if(typeof acc === 'object' && acc !== null) {
          return Object.assign(acc, type(input));
        }
      } catch (e) {
        errors.push(e);
        return acc;
      }
    }, initial);

    if (parsed === initial) {
      throw new Error(`Input does not match any of the provided types: ${JSON.stringify(input)}`, { cause: errors });
    }

    if (errors.length > 0) {
      throw new Error(`Failed to parse input: ${errors.join(", ")}`);
    }

    return parsed as TResult;
  })
}
