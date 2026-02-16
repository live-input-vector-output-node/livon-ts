import { Schema } from './types.js';

interface ResolveCombinatorNameInput {
  fallback: string;
  name?: string;
  options: ReadonlyArray<Schema<unknown>>;
}

const capitalize = (input: string): string =>
  input.length === 0 ? input : `${input.slice(0, 1).toUpperCase()}${input.slice(1)}`;

const buildSchemaNameSegment = (input: string): string => {
  const normalized = input
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment.length > 0)
    .map(capitalize)
    .join('');

  if (normalized.length === 0) {
    return 'Schema';
  }

  return /^[A-Za-z]/.test(normalized) ? normalized : `Schema${normalized}`;
};

export const resolveCombinatorName = ({
  fallback,
  name,
  options,
}: ResolveCombinatorNameInput): string => {
  if (name) {
    return name;
  }

  const joined = options
    .map((option) => buildSchemaNameSegment(option.name))
    .filter((segment) => segment.length > 0)
    .join('Or');

  return joined.length > 0 ? joined : fallback;
};
