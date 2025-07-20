import { createType } from "./createType.js";

export const boolean = createType({ name: 'boolean' }, (input) => {
  if (typeof input !== "boolean") {
    throw new Error(`Invalid input for boolean type: ${JSON.stringify(input)}`);
  }
  return input;
});