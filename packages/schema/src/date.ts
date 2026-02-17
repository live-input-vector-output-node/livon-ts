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
 * @see https://livon.tech/docs/schema/date
 *
 * @example
 * // Creates a date schema and validates a Date object.
 * const CreatedAt = date();
 * CreatedAt.parse(new Date());
 *
 * @example
 * // Extends date validation to also allow null.
 * const MaybeCreatedAt = date().nullable();
 * MaybeCreatedAt.parse(null);
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
