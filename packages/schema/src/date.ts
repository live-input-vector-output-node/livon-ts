import { createAlias } from "./createAlias.js";
import { createType } from "./createType.js";

export const date = createType(createAlias({ name: 'Date' }), (input) => {
  if (!(input instanceof Date || typeof input === "string" || typeof input === "number")) {
    throw new Error(`Invalid input for date type: ${JSON.stringify(input)}`);
  }

  if (input instanceof Date) {
    return input;
  }

  const date = new Date(input);

  if (isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${JSON.stringify(input)}`);
  }
  return date;
})