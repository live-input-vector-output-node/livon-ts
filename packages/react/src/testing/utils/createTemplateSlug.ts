import { randomString } from '../randomData.js';

import type { CreateTemplateSlugInput, UserSlug } from './types.js';

export const createTemplateSlug = (input: CreateTemplateSlugInput = {}): UserSlug => {
  const prefix = input.prefix ?? 'template-id';

  return {
    templateId: randomString({ prefix }),
  };
};
