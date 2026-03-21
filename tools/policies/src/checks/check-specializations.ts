import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { collectFiles, collectProjects, exists, readJson } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface SpecializationEntry {
  readonly id: string;
  readonly scopePatterns: string[];
  readonly instructionFiles: string[];
  readonly requiredLoad?: string[];
  readonly deltaRules?: string[];
}

interface SpecializationsConfig {
  readonly version: number;
  readonly specializations: SpecializationEntry[];
}

const uniqueDuplicates = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  values.forEach((value) => {
    if (seen.has(value)) {
      duplicates.add(value);
      return;
    }
    seen.add(value);
  });
  return [...duplicates];
};

const normalizeRelativePath = (value: string): string => value.replace(/\\/g, '/');

const includesSpecializationMarker = (source: string, specializationId: string): boolean => {
  const escapedId = specializationId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const marker = new RegExp(`specialization-id:\\s*` + '(?:`)?' + escapedId + '(?:`)?', 'i');
  return marker.test(source);
};

const extractSpecializationMarkers = (source: string): string[] => {
  const markers = [...source.matchAll(/specialization-id:\s*(?:`)?([a-z0-9-]+)(?:`)?/gi)]
    .map((match) => match[1]?.trim())
    .filter((value): value is string => Boolean(value));
  return [...new Set(markers)];
};

export const runSpecializationsCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const errors: string[] = [];
  const info: string[] = [];

  const config = await readJson<SpecializationsConfig>(context.aiSpecializationsConfigPath).catch(() => null);
  if (!config) {
    return {
      id: 'specializations',
      errors: ['configs/ai/specializations.json: invalid or unreadable JSON'],
    };
  }

  if (!Array.isArray(config.specializations) || config.specializations.length === 0) {
    return {
      id: 'specializations',
      errors: ['configs/ai/specializations.json: specializations must be a non-empty array'],
    };
  }

  const specializationIds = config.specializations.map((entry) => entry.id);
  const duplicateIds = uniqueDuplicates(specializationIds);
  if (duplicateIds.length > 0) {
    errors.push(`configs/ai/specializations.json: duplicate specialization ids (${duplicateIds.join(', ')})`);
  }

  const declaredInstructionFiles = config.specializations.flatMap((entry) => entry.instructionFiles ?? []);
  const duplicateInstructionFiles = uniqueDuplicates(declaredInstructionFiles);
  if (duplicateInstructionFiles.length > 0) {
    errors.push(
      `configs/ai/specializations.json: instruction file assigned to multiple specializations (${duplicateInstructionFiles.join(', ')})`,
    );
  }

  const sourceChecks = await Promise.all(
    config.specializations.flatMap((entry) => {
      const paths = [...(entry.instructionFiles ?? []), ...(entry.requiredLoad ?? [])];
      return paths.map(async (relativePath) => {
        const absolutePath = path.join(context.baseDir, relativePath);
        return (await exists(absolutePath))
          ? null
          : `configs/ai/specializations.json: missing path ${relativePath} (specialization ${entry.id})`;
      });
    }),
  );
  errors.push(...sourceChecks.filter((entry): entry is string => entry !== null));

  const instructionMarkerChecks = await Promise.all(
    config.specializations.flatMap((entry) =>
      entry.instructionFiles.map(async (relativePath) => {
        const absolutePath = path.join(context.baseDir, relativePath);
        const source = await readFile(absolutePath, 'utf8').catch(() => null);
        if (!source) {
          return null;
        }
        return includesSpecializationMarker(source, entry.id)
          ? null
          : `${relativePath}: missing specialization-id marker for ${entry.id}`;
      }),
    ),
  );
  errors.push(...instructionMarkerChecks.filter((entry): entry is string => entry !== null));

  const packageProjects = await collectProjects(context.packagesDir);
  const packageAgentFiles = (
    await Promise.all(
      packageProjects.map(async (projectPath) => {
        const candidate = path.join(projectPath, 'AGENTS.md');
        return (await exists(candidate)) ? normalizeRelativePath(path.relative(context.baseDir, candidate)) : null;
      }),
    )
  ).filter((entry): entry is string => entry !== null);

  const githubInstructionDir = path.join(context.githubDir, 'instructions');
  const githubInstructionFiles = (await collectFiles(githubInstructionDir))
    .filter((filePath) => filePath.endsWith('.instructions.md'))
    .map((filePath) => normalizeRelativePath(path.relative(context.baseDir, filePath)));

  const actualInstructionFiles = [...packageAgentFiles, ...githubInstructionFiles];
  const declaredSpecializationFiles = new Set(declaredInstructionFiles.map(normalizeRelativePath));
  const knownSpecializationIds = new Set(specializationIds);

  const markerChecks = await Promise.all(
    actualInstructionFiles.map(async (relativePath) => {
      const absolutePath = path.join(context.baseDir, relativePath);
      const source = await readFile(absolutePath, 'utf8').catch(() => null);
      if (!source) {
        return null;
      }
      const markers = extractSpecializationMarkers(source);
      return { markers, relativePath };
    }),
  );

  markerChecks.forEach((entry) => {
    if (!entry) {
      return;
    }
    if (entry.markers.length === 0) {
      return;
    }
    if (entry.markers.length > 1) {
      errors.push(`${entry.relativePath}: multiple specialization-id markers found (${entry.markers.join(', ')})`);
      return;
    }

    const markerId = entry.markers[0];
    if (!knownSpecializationIds.has(markerId)) {
      errors.push(`${entry.relativePath}: unknown specialization-id marker ${markerId}`);
      return;
    }

    if (!declaredSpecializationFiles.has(entry.relativePath)) {
      errors.push(`configs/ai/specializations.json: instruction file with specialization-id must be registered (${entry.relativePath})`);
    }
  });

  const specializationsDoc = await readFile(context.aiSpecializationsDocPath, 'utf8').catch(() => '');
  config.specializations.forEach((entry) => {
    if (!specializationsDoc.includes(`\`${entry.id}\``)) {
      errors.push(`website/docs/ai/specializations.md: missing specialization id marker for ${entry.id}`);
    }
  });

  const promptSource = await readFile(path.join(context.baseDir, 'PROMPT.md'), 'utf8').catch(() => '');
  const agentsSource = await readFile(context.rootAgentsPath, 'utf8').catch(() => '');
  if (!promptSource.includes('/docs/ai/specializations')) {
    errors.push('PROMPT.md: must reference /docs/ai/specializations as canonical deviation source');
  }
  if (!agentsSource.includes('/docs/ai/specializations')) {
    errors.push('AGENTS.md: must reference /docs/ai/specializations as canonical deviation source');
  }

  info.push(
    `specializations=${config.specializations.length}`,
    `instructionFiles=${declaredInstructionFiles.length}`,
    `version=${config.version}`,
  );

  return {
    id: 'specializations',
    errors,
    info,
  };
};
