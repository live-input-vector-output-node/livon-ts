import { mkdir, readdir, readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const TEMPLATES_DIR = path.join(ROOT, 'new_livon', 'tools');
const DEST_APPS = path.join(ROOT, 'new_livon', 'apps');
const DEST_PACKAGES = path.join(ROOT, 'new_livon', 'packages');

const TEMPLATE_MAP = {
  lib: {
    template: 'rslib-package',
    destRoot: DEST_PACKAGES,
  },
  node: {
    template: 'rslib-node',
    destRoot: DEST_PACKAGES,
  },
  browser: {
    template: 'rslib-browser',
    destRoot: DEST_PACKAGES,
  },
  frontend: {
    template: 'rsstack-frontend',
    destRoot: DEST_APPS,
  },
  rsbuild: {
    template: 'rsstack-app',
    destRoot: DEST_APPS,
  },
  rspack: {
    template: 'rspack-app',
    destRoot: DEST_APPS,
  },
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

const copyDir = async (src, dst, { update }) => {
  await ensureDir(dst);
  const entries = await readdir(src, { withFileTypes: true });

  await Promise.all(
    entries.map(async (entry) => {
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);

      if (entry.isDirectory()) {
        await copyDir(srcPath, dstPath, { update });
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

  const exists = await stat(destDir).then(() => true).catch(() => false);

  if (!exists && (isUpdate || isDiff)) {
    console.error('Target does not exist:', destDir);
    process.exit(1);
  }

  if (exists && !isUpdate && !isDiff) {
    console.error('Target already exists:', destDir);
    process.exit(1);
  }

  if (isDiff) {
    const result = spawnSync('git', ['diff', '--no-index', srcDir, destDir], {
      stdio: 'inherit',
    });
    process.exit(result.status ?? 0);
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
