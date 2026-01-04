import { schemaFactory } from './schemaFactory.js';
import { isDate } from './typeGuards.js';
import type { SchemaDoc } from './types.js';

export interface DateFactoryInput {
  name?: string;
  doc?: SchemaDoc;
}

/**
 * date is part of the public LIVON API.
 *
 * @remarks
 * Parameter and return types are defined in the TypeScript signature.
 *
 * @see ${DOCS_HOST:-http://localhost:3000}/docs/schema/date
 *
 * @example
 * const result = date(undefined as never);
 */
export const date = ({ name = 'date', doc }: DateFactoryInput = {}) =>
  schemaFactory<Date>({
    name,
    type: 'date',
    doc,
    ast: () => ({ type: 'date', name }),
    validate: (input) => {
      if (!isDate(input)) {
        throw { message: 'Expected Date', code: 'date.type' };
      }
      return input;
    },
  });
