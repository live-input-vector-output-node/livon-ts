import { createType } from "./createType.js";
import { SchemaType } from "./types.js";
import { number } from "./number.js";
import { object } from "./object.js";
import { string } from "./string.js";

export const optional = <T extends SchemaType<any, any>>(type: T) => {
  return createType({ name: 'undefined' }, (input): ReturnType<T> | undefined => {
    if (input === undefined) {
      return input;
    }
    return type(input);
  });
};

const optionalUser = optional(object('User', { firstName: string, lastName: string, age: number }));

optionalUser('')