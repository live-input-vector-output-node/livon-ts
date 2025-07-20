import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

export const object = <
  T extends { [Key: string | number]: SchemaType<any, any> },
  TReturn extends {
    [Key in keyof T]: ReturnType<T[Key]>;
  }
>(
  name: string,
  schema: T,
) => {
  const aliasOptions = createAlias({
    name,
    properties: Object.fromEntries(
      Object.entries(schema).map(
        ([key, type]) => [key, type.alias] as const
      )
    )
  })

  return createType(aliasOptions, (input) => {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new Error(`Expected an object for ${name}, but received: ${JSON.stringify(input)}`);
    }

    return Object.entries(schema).reduce<TReturn>((acc, [key, type]) => {
      return { ...acc, [key]: type(input[key as keyof typeof input]) };
    }, {} as TReturn);
  });
}