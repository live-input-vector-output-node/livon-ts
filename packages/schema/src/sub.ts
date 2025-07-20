import { RefloContext } from "@livo/types/context.ts";
import { SchemaType } from "./types.js";
import { object } from "./object.js";
import { string } from "./string.js";
import { number } from "./number.js";
import { optional } from "./optional.js";

export interface SubOptions<
  TInput extends SchemaType<any, any>,
  TParsedInput extends ReturnType<TInput>
> {
  event: string;
  result: SchemaType<any, any>;
  input?: TInput;
  filter?: (input: TParsedInput) => boolean;
}

const sub = <TInput extends SchemaType<any, any>, TParsedInput extends ReturnType<TInput>>(
  {
    event,
    result,
    input
  }: SubOptions<TInput, TParsedInput>,
  implementation: (input: TParsedInput, { }) => ReturnType<typeof result> | Promise<ReturnType<typeof result>>
) => {
  return (context: RefloContext) => {

  }
}

const user = object('User', {
  firstName: string,
  lastName: optional(string),
  age: number
});

sub({
  event: 'user.created',
  input: user,
  result: string,
}, (x, { }) => {
  return '';
})
