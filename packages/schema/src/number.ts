import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";

/**
 * A schema type for numbers.
 * @param input - The input to validate as a number.
 * @throws Will throw an error if the input is not a number.
 * @returns The validated number input.
 */
export const number = createType({ name: 'number' }, (input?: number | {}) => {
  if (typeof input !== "number") {
    throw new Error(`Invalid input for number type: ${JSON.stringify(input)}`);
  }

  return input;
});