import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";
import { SchemaType } from "./types.js";
import { union } from "./union.js";

export const additionalProperties = <
  TParent extends SchemaType<{}, any>,
  TParentType extends ReturnType<TParent>,
  TAdditional extends SchemaType<any, any>,
  TResolved extends { [key: string | number]: ReturnType<TAdditional> } & TParentType
>(
  name: string,
  parent: TParent,
  additional: TAdditional
): SchemaType<TResolved> => {
  const alias = createAlias({
    additionalProperties: additional.alias,
  });

  const andAlias = createAlias({
    and: [parent.alias, alias]
  });

  return createType(andAlias, (input) => {
    if(input === null || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error(`Expected an object for ${name}, but received: ${JSON.stringify(input)}`);
    }

    const parentResult = parent(input);
    const parentKeys = Object.keys(parentResult);
    const additionalKeys = Object.keys(input).filter(key => !parentKeys.includes(key));
    return {
      ...parentResult,
      ...additionalKeys.reduce((acc, key) => {
          acc[key] = additional(input[key as keyof typeof input]);
        return acc;
      }, {} as { [key: string | number]: ReturnType<TAdditional> })
    } as TResolved
  });
}
