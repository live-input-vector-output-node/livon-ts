import { createType } from "./createType.js";
import { SchemaType } from "./types.js";

const tuple = <
  T extends SchemaType<any, any>[],
  TReturn extends {
    [K in keyof T]: ReturnType<T[K]>
  }
>(...types: T) => createType({ tuple: types.map(type => type.alias) }, (inputs) => {
  if (!Array.isArray(inputs)) {
    throw new Error(`Tuple needs to be from type array, got: ${JSON.stringify(inputs)}`);
  }

  if (inputs.length !== types.length) {
    throw new Error(`Tuple length mismatch: expected ${types.length}, got ${inputs.length}`);
  }
  const errors: any[] = [];
  const parsed = types.reduce<TReturn>((acc, type, index) => {
    try {
      acc[index] = type(inputs[index]);
      return acc;
    } catch (e) {
      errors.push(e);
      return acc;
    }
  }, [] as unknown as TReturn);

  if (errors.length > 0) {
    throw new Error(`Tuple parsing errors: ${JSON.stringify(errors)}`);
  }

  return parsed;
});

