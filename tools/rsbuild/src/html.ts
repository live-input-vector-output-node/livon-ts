import type { RsbuildConfig } from '@rsbuild/core';
import { mergeRsbuildOptions } from './merge.ts';
import type { HtmlInput, RsbuildBuilder } from './types.ts';

const createHtmlOptions = (template: HtmlInput['template']): RsbuildConfig => {
  return {
    html: {
      template,
    },
  };
};

export const html = (template: HtmlInput['template'], config: RsbuildConfig = {}): RsbuildBuilder => {
  return () => {
    const defaults = createHtmlOptions(template);
    return mergeRsbuildOptions(defaults, config);
  };
};
