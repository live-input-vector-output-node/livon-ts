export const normalizePath = (value: string): string => value.replace(/\\/g, '/');

export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export const globPatternToRegex = (pattern: string): RegExp => {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '::DOUBLE_STAR::')
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`);
};

export const matchesAnyPattern = (targetPath: string, patterns: readonly string[]): boolean => {
  const normalizedTarget = normalizePath(targetPath);
  return patterns.some((pattern) => globPatternToRegex(normalizePath(pattern)).test(normalizedTarget));
};
