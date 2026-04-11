import type { RsbuildConfig } from '@rsbuild/core';

export type RsbuildBuilder = () => RsbuildConfig;

export interface EntryInput {
  index: string;
}

export interface HtmlInput {
  template: string;
}
