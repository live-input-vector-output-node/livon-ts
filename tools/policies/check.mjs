import { existsSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const BASE = existsSync(path.join(ROOT, 'pnpm-workspace.yaml')) ? ROOT : path.join(ROOT, 'new_livon');
const PACKAGES_DIR = path.join(BASE, 'packages');
const APPS_DIR = path.join(BASE, 'apps');
const TOOLS_DIR = path.join(BASE, 'tools');
const WEBSITE_DIR = path.join(BASE, 'website');
const ROOT_PACKAGE_JSON_PATH = path.join(BASE, 'package.json');
const SOURCE_DIR = 'src';
const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'];
const SKIPPED_DIR_NAMES = ['node_modules', 'dist', '.turbo', '.git', 'coverage', 'build'];
const FORBIDDEN_MANUAL_VALIDATION_HELPER_PATTERNS = [
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+parse[A-Z][A-Za-z0-9_]*\s*(?::[^=\n]+)?=/g,
  /(?:^|\n)\s*(?:export\s+)?function\s+parse[A-Z][A-Za-z0-9_]*\s*\(/g,
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+to[A-Z][A-Za-z0-9_]*\s*(?::[^=\n]+)?=/g,
  /(?:^|\n)\s*(?:export\s+)?function\s+to[A-Z][A-Za-z0-9_]*\s*\(/g,
];

const REQUIRED_LIB_SCRIPTS = ['build', 'dev', 'lint', 'typecheck', 'test', 'test:unit', 'test:integration'];
const REQUIRED_APP_SCRIPTS = ['build', 'dev', 'lint', 'typecheck', 'preview', 'test', 'test:unit', 'test:integration'];
const REQUIRED_PACKAGE_FIELDS = {
  namePrefix: '@livon/',
  type: 'module',
};

const exists = async (p) => stat(p).then(() => true).catch(() => false);
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const isSourceFile = (filePath) => SOURCE_EXTENSIONS.some((ext) => filePath.endsWith(ext));
const shouldSkipDir = (name) => SKIPPED_DIR_NAMES.includes(name);

const collectProjects = async (rootDir) => {
  if (!(await exists(rootDir))) return [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => path.join(rootDir, e.name));
  const checks = await Promise.all(
    dirs.map(async (dir) => ((await exists(path.join(dir, 'package.json'))) ? dir : null)),
  );
  return checks.filter((dir) => dir !== null);
};

const checkScripts = (pkgJson, required, projectPath) => {
  const scripts = pkgJson.scripts || {};
  const missing = required.filter((key) => !scripts[key]);
  if (missing.length > 0) {
    return [`${projectPath}: missing scripts: ${missing.join(', ')}`];
  }
  const invalid = Object.entries(scripts)
    .filter(([, value]) => typeof value === 'string')
    .filter(([, value]) => /&&|\|\||;/.test(value))
    .map(([key]) => key);
  if (invalid.length > 0) {
    return [`${projectPath}: scripts must not chain commands with &&, ||, or ; (${invalid.join(', ')})`];
  }
  return [];
};

const checkPackageMeta = (pkgJson, projectPath) => {
  const errors = [];

  if (typeof pkgJson.name !== 'string' || !pkgJson.name.startsWith(REQUIRED_PACKAGE_FIELDS.namePrefix)) {
    errors.push(`${projectPath}: package name must start with ${REQUIRED_PACKAGE_FIELDS.namePrefix}`);
  }

  if (pkgJson.type !== REQUIRED_PACKAGE_FIELDS.type) {
    errors.push(`${projectPath}: package.json type must be ${REQUIRED_PACKAGE_FIELDS.type}`);
  }

  return errors;
};

const checkTsconfig = async (projectPath) => {
  const tsconfigPath = path.join(projectPath, 'tsconfig.json');
  if (!(await exists(tsconfigPath))) return [];
  const config = await readJson(tsconfigPath).catch(() => null);
  if (!config || typeof config.extends !== 'string') {
    return [`${projectPath}: tsconfig.json missing extends`];
  }
  if (!config.extends.startsWith('@livon/config/tsconfig/')) {
    return [`${projectPath}: tsconfig.json must extend @livon/config/tsconfig/*`];
  }
  return [];
};

const checkEslint = async (projectPath) => {
  const eslintPath = path.join(projectPath, 'eslint.config.cjs');
  if (!(await exists(eslintPath))) return [];
  const raw = await readFile(eslintPath, 'utf8');
  if (!raw.includes("@livon/config/eslint/base.cjs")) {
    return [`${projectPath}: eslint.config.cjs must require @livon/config/eslint/base.cjs`];
  }
  return [];
};

const collectSourceFiles = async (dirPath) => {
  if (!(await exists(dirPath))) {
    return [];
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(entry.name)) {
          return [];
        }
        return collectSourceFiles(absolutePath);
      }
      if (!entry.isFile() || !isSourceFile(absolutePath)) {
        return [];
      }
      return [absolutePath];
    }),
  );
  return nested.flat();
};

const checkForbiddenManualValidationHelpers = async (projectPath) => {
  const sourceRoot = path.join(projectPath, SOURCE_DIR);
  if (!(await exists(sourceRoot))) {
    return [];
  }

  const sourceFiles = await collectSourceFiles(sourceRoot);
  const violations = await Promise.all(
    sourceFiles.map(async (filePath) => {
      const source = await readFile(filePath, 'utf8');
      const hasForbiddenHelper = FORBIDDEN_MANUAL_VALIDATION_HELPER_PATTERNS.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(source);
      });
      if (!hasForbiddenHelper) {
        return [];
      }
      return [
        `${path.relative(BASE, filePath)}: manual parseX/toX helper declaration is forbidden. Use schema composition and schema.parse.`,
      ];
    }),
  );
  return violations.flat();
};

const checkVersionParity = async (projectPaths) => {
  const rootPackageJson = await readJson(ROOT_PACKAGE_JSON_PATH).catch(() => null);
  if (!rootPackageJson || typeof rootPackageJson.version !== 'string') {
    return ['package.json: root version must be defined as a string'];
  }

  const expectedVersion = rootPackageJson.version;
  const packageJsonPaths = [
    ROOT_PACKAGE_JSON_PATH,
    ...projectPaths.map((projectPath) => path.join(projectPath, 'package.json')),
  ];

  const checks = await Promise.all(
    packageJsonPaths.map(async (packageJsonPath) => {
      const pkgJson = await readJson(packageJsonPath).catch(() => null);
      const relativePath = path.relative(BASE, packageJsonPath);
      if (!pkgJson || typeof pkgJson.version !== 'string') {
        return [`${relativePath}: version must be defined as a string`];
      }
      if (pkgJson.version !== expectedVersion) {
        return [
          `${relativePath}: version "${pkgJson.version}" must match root package.json version "${expectedVersion}"`,
        ];
      }
      return [];
    }),
  );

  return checks.flat();
};

const run = async () => {
  const errors = [];

  const packages = await collectProjects(PACKAGES_DIR);
  const apps = await collectProjects(APPS_DIR);
  const tools = await collectProjects(TOOLS_DIR);
  const websiteProjects = (await exists(path.join(WEBSITE_DIR, 'package.json'))) ? [WEBSITE_DIR] : [];

  await Promise.all(
    packages.map(async (projectPath) => {
      const pkgJson = await readJson(path.join(projectPath, 'package.json'));
      errors.push(...checkPackageMeta(pkgJson, projectPath));
      errors.push(...checkScripts(pkgJson, REQUIRED_LIB_SCRIPTS, projectPath));
      errors.push(...(await checkTsconfig(projectPath)));
      errors.push(...(await checkEslint(projectPath)));
      errors.push(...(await checkForbiddenManualValidationHelpers(projectPath)));
    }),
  );

  await Promise.all(
    apps.map(async (projectPath) => {
      const pkgJson = await readJson(path.join(projectPath, 'package.json'));
      errors.push(...checkPackageMeta(pkgJson, projectPath));
      errors.push(...checkScripts(pkgJson, REQUIRED_APP_SCRIPTS, projectPath));
      errors.push(...(await checkTsconfig(projectPath)));
      errors.push(...(await checkEslint(projectPath)));
      errors.push(...(await checkForbiddenManualValidationHelpers(projectPath)));
    }),
  );

  errors.push(...(await checkVersionParity([...packages, ...apps, ...tools, ...websiteProjects])));

  if (errors.length > 0) {
    console.error('Policy check failed:');
    errors.forEach((err) => {
      console.error(`- ${err}`);
    });
    process.exit(1);
  }

  console.log('Policy check passed.');
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
