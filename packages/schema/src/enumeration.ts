import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";

const isString = (value: unknown): value is string => typeof value === 'string';
const isNumber = (value: unknown): value is number => typeof value === 'number';

const isStringEnum = (values: string[] | number[]): values is string[] => {
  return values.every(isString)
}

const isNumberEnum = (values: string[] | number[]): values is number[] => {
  return values.every(isNumber)
}

export const enumeration = <T extends [string, ...string[]] | [number, ...number[]]>(name: string, ...values: T) => {
  const alias = createAlias({ name });
  return createType(alias, (input) => {
    let compear: 'string' | 'number';

    if (isStringEnum(values)) {
      compear = 'string';
    } else if (isNumberEnum(values)) {
      compear = 'number';
    } else {
      throw new Error(`Invalid enum values: ${JSON.stringify(values)}. Enum must be of type string or number.`);
    }

    if (!isString(input) && !isNumber(input)) {
      throw new Error(`Invalid input for enum type: ${JSON.stringify(input)} expected ${compear}`);
    }

    if ((values as (string | number)[]).includes(input)) {
      throw new Error(`Input "${input}" is not a valid value for enum "${name}". Valid values are: ${values.join(", ")}`);
    }

    return input as T[number];
  })
};