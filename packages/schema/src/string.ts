import { createType } from "./createType.js";


/**
 * 
 * @param input - The input to validate as a string.
 * @throws Will throw an error if the input is not a string.
 * @returns The validated string input.
 */
export const string = createType({ name: 'string' }, (input?: string | {}) => {
  if (typeof input !== "string") {
    throw new Error(`Invalid input for string type: ${JSON.stringify(input)}`);
  }
  return input;
});