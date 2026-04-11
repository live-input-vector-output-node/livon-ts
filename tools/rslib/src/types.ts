import type { RslibConfig } from '@rslib/core';

export type RslibEntryValue = string | string[];
export type RslibFormats = readonly ('esm' | 'cjs')[];
export type RslibBuilder = () => RslibConfig;

export interface EntryInput {
  entries: Readonly<Record<string, RslibEntryValue>>;
}

export interface LibraryInput {
  formats?: RslibFormats;
}
