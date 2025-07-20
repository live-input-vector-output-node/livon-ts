import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

/**
 * A schema type that allows for nullable values.
 * @param type - The schema type to be made nullable.
 * @returns A new schema type that accepts the original type or null.
 */
export const nullable = <T extends SchemaType<any, any>>(type: T) => {
  return createType({ union: [type.alias, createAlias({ name: 'null' })] }, (input): ReturnType<T> | null => {
    if (input === null) {
      return input;
    }
    return type(input);
  });
};