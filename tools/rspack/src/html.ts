import type { Configuration } from '@rspack/core';
import { HtmlRspackPlugin } from '@rspack/core';
import { mergeRspackOptions } from './merge.ts';
import type { HtmlInput, RspackBuilder } from './types.ts';

const createHtmlOptions = (template: HtmlInput['template']): Configuration => {
  return {
    plugins: [new HtmlRspackPlugin({ template })],
  };
};

export const html = (template: HtmlInput['template'], config: Configuration = {}): RspackBuilder => {
  return () => {
    const defaults = createHtmlOptions(template);
    return mergeRspackOptions(defaults, config);
  };
};
