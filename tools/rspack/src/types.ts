import type { Configuration } from '@rspack/core';

export type RspackBuilder = () => Configuration;

export interface EntryInput {
  index: string;
}

export interface HtmlInput {
  template: string;
}

export type DevServerInput = NonNullable<Configuration['devServer']>;
