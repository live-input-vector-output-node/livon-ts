import path from 'node:path';
import { exists, readJson } from '../shared/fs-utils.ts';
import type { PolicyCheckResult, PolicyContext } from '../shared/types.ts';

interface MultiAgentRole {
  readonly id: string;
  readonly name: string;
  readonly skillFile: string;
}

interface MultiAgentStage {
  readonly id: string;
  readonly ownerRoleId: string;
  readonly consultedRoleIds?: string[];
  readonly mustCompleteBefore?: string[];
}

interface MultiAgentConstraints {
  readonly requirePoStageFirst?: boolean;
  readonly requireCrossRoleConsultation?: boolean;
  readonly requirePerformanceReviewBeforeFinalDecision?: boolean;
}

interface MultiAgentCouncilConfig {
  readonly version: number;
  readonly roles: MultiAgentRole[];
  readonly stages: MultiAgentStage[];
  readonly constraints?: MultiAgentConstraints;
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

export const runMultiAgentCouncilCheck = async (context: PolicyContext): Promise<PolicyCheckResult> => {
  const configPath = path.join(context.baseDir, 'configs', 'ai', 'multi-agent-council.json');
  const config = await readJson<MultiAgentCouncilConfig>(configPath).catch(() => null);
  if (!config) {
    return {
      id: 'multi-agent-council',
      errors: ['configs/ai/multi-agent-council.json: invalid or unreadable JSON'],
    };
  }

  const errors: string[] = [];
  const info: string[] = [];

  if (!Array.isArray(config.roles) || config.roles.length === 0) {
    errors.push('configs/ai/multi-agent-council.json: roles must be a non-empty array');
  }
  if (!Array.isArray(config.stages) || config.stages.length === 0) {
    errors.push('configs/ai/multi-agent-council.json: stages must be a non-empty array');
  }
  if (errors.length > 0) {
    return {
      id: 'multi-agent-council',
      errors,
    };
  }

  const roleIds = config.roles.map((role) => role.id);
  const stageIds = config.stages.map((stage) => stage.id);
  const duplicateRoleIds = uniqueDuplicates(roleIds);
  const duplicateStageIds = uniqueDuplicates(stageIds);
  if (duplicateRoleIds.length > 0) {
    errors.push(`configs/ai/multi-agent-council.json: duplicate role ids (${duplicateRoleIds.join(', ')})`);
  }
  if (duplicateStageIds.length > 0) {
    errors.push(`configs/ai/multi-agent-council.json: duplicate stage ids (${duplicateStageIds.join(', ')})`);
  }

  const roleIdSet = new Set(roleIds);
  const stageIdSet = new Set(stageIds);

  const skillFileChecks = await Promise.all(
    config.roles.map(async (role) => {
      if (typeof role.id !== 'string' || role.id.trim().length === 0) {
        return 'configs/ai/multi-agent-council.json: each role must define a non-empty id';
      }
      if (typeof role.skillFile !== 'string' || role.skillFile.trim().length === 0) {
        return `configs/ai/multi-agent-council.json: role ${role.id} must define skillFile`;
      }
      const skillAbsolutePath = path.join(context.baseDir, role.skillFile);
      return (await exists(skillAbsolutePath))
        ? null
        : `configs/ai/multi-agent-council.json: missing role skill file (${role.id} -> ${role.skillFile})`;
    }),
  );
  errors.push(...skillFileChecks.filter((entry): entry is string => entry !== null));

  config.stages.forEach((stage, index) => {
    if (typeof stage.id !== 'string' || stage.id.trim().length === 0) {
      errors.push('configs/ai/multi-agent-council.json: each stage must define a non-empty id');
      return;
    }
    if (!roleIdSet.has(stage.ownerRoleId)) {
      errors.push(
        `configs/ai/multi-agent-council.json: stage ${stage.id} references unknown ownerRoleId ${stage.ownerRoleId}`,
      );
    }

    (stage.consultedRoleIds ?? []).forEach((roleId) => {
      if (!roleIdSet.has(roleId)) {
        errors.push(`configs/ai/multi-agent-council.json: stage ${stage.id} references unknown consulted role ${roleId}`);
      }
    });

    (stage.mustCompleteBefore ?? []).forEach((targetStageId) => {
      if (!stageIdSet.has(targetStageId)) {
        errors.push(
          `configs/ai/multi-agent-council.json: stage ${stage.id} references unknown stage ${targetStageId} in mustCompleteBefore`,
        );
      }
    });

    if (index === 0 && config.constraints?.requirePoStageFirst === true && stage.ownerRoleId !== 'po-dx-designer') {
      errors.push('configs/ai/multi-agent-council.json: first stage must be owned by po-dx-designer');
    }
  });

  if (config.constraints?.requireCrossRoleConsultation === true) {
    const hasConsultedRoles = config.stages.some((stage) => (stage.consultedRoleIds ?? []).length > 0);
    if (!hasConsultedRoles) {
      errors.push('configs/ai/multi-agent-council.json: requireCrossRoleConsultation=true but no stage defines consultedRoleIds');
    }
  }

  if (config.constraints?.requirePerformanceReviewBeforeFinalDecision === true) {
    const performanceStage = config.stages.find((stage) => stage.id === 'performance-budget');
    const hasGateToFinal = Boolean(performanceStage?.mustCompleteBefore?.includes('final-council-decision'));
    if (!hasGateToFinal) {
      errors.push(
        'configs/ai/multi-agent-council.json: performance-budget stage must gate final-council-decision when performance review is required',
      );
    }
  }

  info.push(`roles=${config.roles.length}`, `stages=${config.stages.length}`, `version=${config.version}`);

  return {
    id: 'multi-agent-council',
    errors,
    info,
  };
};
