import { mkdir, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const resolveWorkspaceRoot = (startDir = process.cwd()) => {
  let currentDir = path.resolve(startDir);
  while (true) {
    if (existsSync(path.join(currentDir, 'pnpm-workspace.yaml'))) {
      return currentDir;
    }
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }
  return path.resolve(startDir);
};

const ROOT = resolveWorkspaceRoot();
const TEMPLATES_DIR = path.join(ROOT, 'tools');
const DEST_APPS = path.join(ROOT, 'apps');
const DEST_PACKAGES = path.join(ROOT, 'packages');
const NULL_DEVICE_PATH = process.platform === 'win32' ? 'NUL' : '/dev/null';

const TEMPLATE_MAP = {
  lib: {
    template: 'rslib/templates/package-name',
    destRoot: DEST_PACKAGES,
  },
  node: {
    template: 'rslib/templates/node-lib',
    destRoot: DEST_PACKAGES,
  },
  browser: {
    template: 'rslib/templates/browser-lib',
    destRoot: DEST_PACKAGES,
  },
  frontend: {
    template: 'rsbuild/templates/frontend-app',
    destRoot: DEST_APPS,
  },
  rsbuild: {
    template: 'rsbuild/templates/app-name',
    destRoot: DEST_APPS,
  },
  rspack: {
    template: 'rspack/templates/app',
    destRoot: DEST_APPS,
  },
};

const EXCLUDED_TEMPLATE_SEGMENTS = new Set(['.turbo', 'coverage', 'dist', 'node_modules']);

const isTemplateManagedPath = (relativePath) => {
  if (!relativePath) {
    return true;
  }

  return !relativePath.split(path.sep).some((segment) => EXCLUDED_TEMPLATE_SEGMENTS.has(segment));
};

const CONFIG_FILE_PATTERNS = [
  /^package\.json$/,
  /^\.npmignore$/,
  /^tsconfig(\..+)?\.json$/,
  /^eslint\.config\.(ts|js|mjs|cjs)$/,
  /^vitest(\..+)?\.config\.(ts|js|mjs|cjs)$/,
  /^rslib(\..+)?\.config\.(ts|js|mjs|cjs)$/,
  /^rsbuild(\..+)?\.config\.(ts|js|mjs|cjs)$/,
  /^rspack(\..+)?\.config\.(ts|js|mjs|cjs)$/,
];

const isConfigFile = (relativePath) => {
  const fileName = path.basename(relativePath);
  return CONFIG_FILE_PATTERNS.some((pattern) => pattern.test(fileName));
};

const isSourceFile = (relativePath) => {
  const normalized = relativePath.split(path.sep);
  return normalized[0] === 'src';
};

const resolveUpdateMode = (relativePath) => {
  if (path.basename(relativePath) === 'package.json') {
    return 'merge-package-json';
  }

  if (isConfigFile(relativePath)) {
    return 'overwrite';
  }

  if (isSourceFile(relativePath)) {
    return 'copy-if-missing';
  }

  return 'skip';
};

const usage = () => {
  console.log('Usage:');
  console.log('  pnpm gen <type> <name>');
  console.log('  pnpm gen <type> update <name>');
  console.log('  pnpm gen <type> diff <name>');
  console.log('');
  console.log('Types:', Object.keys(TEMPLATE_MAP).join(', '));
};

const ensureDir = async (dir) => {
  await mkdir(dir, { recursive: true });
};

const readJson = async (filePath) => {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw);
};

const writeJson = async (filePath, data) => {
  const raw = JSON.stringify(data, null, 2) + '\n';
  await writeFile(filePath, raw, 'utf8');
};

const pathExists = async (targetPath) => {
  return stat(targetPath)
    .then(() => true)
    .catch(() => false);
};

const collectTemplateFiles = async (dir, parent = '') => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  await Promise.all(
    entries.map(async (entry) => {
      const relativePath = parent ? path.join(parent, entry.name) : entry.name;
      if (!isTemplateManagedPath(relativePath)) {
        return;
      }

      const absolutePath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const nested = await collectTemplateFiles(absolutePath, relativePath);
        files.push(...nested);
        return;
      }

      if (entry.isFile()) {
        files.push(relativePath);
      }
    }),
  );

  return files.sort();
};

const diffTemplateFiles = async ({ srcDir, destDir }) => {
  const templateFiles = await collectTemplateFiles(srcDir);
  let hasDiff = false;

  templateFiles.forEach((relativePath) => {
    const updateMode = resolveUpdateMode(relativePath);
    if (updateMode === 'skip') {
      return;
    }

    const srcPath = path.join(srcDir, relativePath);
    const dstPath = path.join(destDir, relativePath);
    const dstExists = existsSync(dstPath);

    if (updateMode === 'copy-if-missing' && dstExists) {
      return;
    }

    const args = dstExists
      ? ['diff', '--no-index', srcPath, dstPath]
      : ['diff', '--no-index', NULL_DEVICE_PATH, srcPath];
    const result = spawnSync('git', args, { stdio: 'inherit' });

    if ((result.status ?? 0) !== 0) {
      hasDiff = true;
    }
  });

  return hasDiff ? 1 : 0;
};

const mergePackageJson = (existing, template) => {
  const merged = {
    ...template,
    ...existing,
  };

  // Never overwrite project-specific fields
  merged.name = existing.name ?? template.name;
  merged.version = existing.version ?? template.version;
  if (existing.private !== undefined) {
    merged.private = existing.private;
  }

  const addMissing = (current, fromTemplate) =>
    Object.entries(fromTemplate || {}).reduce(
      (result, [key, value]) => {
        if (result[key] === undefined) {
          result[key] = value;
        }
        return result;
      },
      { ...(current || {}) },
    );

  merged.dependencies = addMissing(existing.dependencies, template.dependencies);
  merged.devDependencies = addMissing(existing.devDependencies, template.devDependencies);
  merged.peerDependencies = addMissing(existing.peerDependencies, template.peerDependencies);

  // Ensure standard workflow scripts stay aligned to the template
  merged.scripts = {
    ...(existing.scripts || {}),
    ...(template.scripts || {}),
  };

  // Never overwrite exports
  if (existing.exports !== undefined) {
    merged.exports = existing.exports;
  }

  return merged;
};

const copyDir = async (src, dst, { update, parent = '' }) => {
  await ensureDir(dst);
  const entries = await readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      const relativePath = parent ? path.join(parent, entry.name) : entry.name;
      if (!isTemplateManagedPath(relativePath)) {
        return;
      }

      if (entry.isDirectory()) {
        await copyDir(srcPath, dstPath, { update, parent: relativePath });
        return;
      }

      if (entry.isFile() && entry.name === 'package.json' && update) {
        const existing = await readJson(dstPath).catch(() => null);
        const template = await readJson(srcPath);

        if (!existing) {
          await copyFile(srcPath, dstPath);
          return;
        }

        const merged = mergePackageJson(existing, template);
        await writeJson(dstPath, merged);
        return;
      }

      if (update) {
        const updateMode = resolveUpdateMode(relativePath);

        if (updateMode === 'skip') {
          return;
        }

        if (updateMode === 'copy-if-missing') {
          const exists = await pathExists(dstPath);
          if (exists) {
            return;
          }
        }
      }

      await copyFile(srcPath, dstPath);
    }),
  );
};

const main = async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    usage();
    process.exit(1);
  }

  const [type, modeOrName, maybeName] = args;
  const isUpdate = modeOrName === 'update';
  const isDiff = modeOrName === 'diff';
  const name = isUpdate || isDiff ? maybeName : modeOrName;

  if (!TEMPLATE_MAP[type] || !name) {
    usage();
    process.exit(1);
  }

  const { template, destRoot } = TEMPLATE_MAP[type];
  const srcDir = path.join(TEMPLATES_DIR, template);
  const destDir = path.join(destRoot, name);

  const exists = await pathExists(destDir);

  if (!exists && (isUpdate || isDiff)) {
    console.error('Target does not exist:', destDir);
    process.exit(1);
  }

  if (exists && !isUpdate && !isDiff) {
    console.error('Target already exists:', destDir);
    process.exit(1);
  }

  if (isDiff) {
    const status = await diffTemplateFiles({ srcDir, destDir });
    process.exit(status);
  }

  await copyDir(srcDir, destDir, { update: isUpdate });

  if (!isUpdate) {
    console.log('Created:', destDir);
    console.log('Remember to set package name in package.json.');
  } else {
    console.log('Updated from template:', destDir);
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
