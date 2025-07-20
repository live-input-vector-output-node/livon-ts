import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

export const array = <
  T extends SchemaType<any, any>,
  TReturn extends ReturnType<T>
>(type: T) => {
  return createType({ array: type.alias }, (input): TReturn[] => {
    if (!Array.isArray(input)) {
      throw new Error(`Invalid input for array type: ${JSON.stringify(input)}`);
    }
    return input.map(item => type(item));
  })
};