import type { PackageJsonLike } from '../../shared/types.ts';

export const checkRequiredScripts = (
  pkgJson: PackageJsonLike,
  requiredScripts: readonly string[],
  projectPath: string,
): string[] => {
  const scripts = pkgJson.scripts ?? {};
  const missingScripts = requiredScripts.filter((scriptName) => !scripts[scriptName]);
  if (missingScripts.length > 0) {
    return [`${projectPath}: missing scripts: ${missingScripts.join(', ')}`];
  }

  const invalidScripts = Object.entries(scripts)
    .filter(([, value]) => typeof value === 'string')
    .filter(([, value]) => /&&|\|\||;/.test(value))
    .map(([scriptName]) => scriptName);

  if (invalidScripts.length > 0) {
    return [`${projectPath}: scripts must not chain commands with &&, ||, or ; (${invalidScripts.join(', ')})`];
  }

  return [];
};
