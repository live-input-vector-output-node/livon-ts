export interface RefloError{
  message: string;
  name: string;
  code: string;
  path?: string;
  extendsions: Record<string, any>;
}

export const RefloError = class extends Error {
  constructor(error: RefloError) {
    super(error.message);
  }
}
