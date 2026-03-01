import type { PackageJsonLike } from '../../shared/types.ts';

export interface RequiredPackageFields {
  readonly namePrefix: string;
  readonly type: string;
}

export const checkPackageMeta = (
  pkgJson: PackageJsonLike,
  projectPath: string,
  requiredFields: RequiredPackageFields,
): string[] => {
  const errors: string[] = [];

  if (typeof pkgJson.name !== 'string' || !pkgJson.name.startsWith(requiredFields.namePrefix)) {
    errors.push(`${projectPath}: package name must start with ${requiredFields.namePrefix}`);
  }

  if (pkgJson.type !== requiredFields.type) {
    errors.push(`${projectPath}: package.json type must be ${requiredFields.type}`);
  }

  return errors;
};
