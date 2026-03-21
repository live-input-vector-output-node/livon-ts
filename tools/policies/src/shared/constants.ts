export const SOURCE_DIR = 'src';
export const SOURCE_EXTENSIONS = ['.ts', '.tsx', '.js', '.mjs'] as const;
export const SKIPPED_DIR_NAMES = ['node_modules', 'dist', '.turbo', '.git', 'coverage', 'build'] as const;

export const MARKDOWN_FILE_EXTENSION = '.md';
export const LOWER_KEBAB_MARKDOWN_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.instructions)?\.md$/;
export const MARKDOWN_NAME_EXCEPTIONS = new Set(['AGENTS.md', 'PROMPT.md', 'PROMPTS.md', 'SKILL.md']);

export const REQUIRED_AI_CONTROL_FILES = [
  'AGENTS.md',
  'configs/ai/context-routing.json',
  'configs/ai/multi-agent-council.json',
  'configs/ai/root-gate.json',
  'configs/ai/specializations.json',
  'website/docs/ai/index.md',
  'website/docs/ai/root-gate.md',
  'website/docs/ai/specializations.md',
  'website/docs/ai/context-routing.md',
  'website/docs/ai/active-rules-and-gates.md',
  'website/docs/ai/tool-mapping.md',
  'website/docs/ai/approach-and-rationale.md',
  'website/docs/ai/multi-agent-council.md',
  '.github/copilot-instructions.md',
  '.github/instructions/schema.instructions.md',
  '.github/instructions/client.instructions.md',
  '.github/instructions/runtime.instructions.md',
  '.github/skills/gate-review/SKILL.md',
  '.github/skills/multi-agent-council/SKILL.md',
  '.github/skills/po-dx-designer/SKILL.md',
  '.github/skills/system-architect/SKILL.md',
  '.github/skills/backend-architect/SKILL.md',
  '.github/skills/frontend-architect/SKILL.md',
  '.github/skills/performance-specialist/SKILL.md',
  '.github/skills/update-mermaid/SKILL.md',
  'apps/AGENTS.md',
  'packages/AGENTS.md',
  'tools/AGENTS.md',
  'packages/schema/AGENTS.md',
  'packages/client/AGENTS.md',
  'packages/runtime/AGENTS.md',
  'packages/runtime/PROMPT.md',
] as const;

export const REQUIRED_LIB_SCRIPTS = [
  'build',
  'dev',
  'lint',
  'typecheck',
  'test',
  'test:unit',
  'test:integration',
] as const;

export const REQUIRED_APP_SCRIPTS = [
  'build',
  'dev',
  'lint',
  'typecheck',
  'preview',
  'test',
  'test:unit',
  'test:integration',
] as const;

export const REQUIRED_PACKAGE_FIELDS = {
  namePrefix: '@livon/',
  type: 'module',
} as const;

export const FORBIDDEN_MANUAL_VALIDATION_HELPER_PATTERNS = [
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+parse[A-Z][A-Za-z0-9_]*\s*(?::[^=\n]+)?=/g,
  /(?:^|\n)\s*(?:export\s+)?function\s+parse[A-Z][A-Za-z0-9_]*\s*\(/g,
  /(?:^|\n)\s*(?:export\s+)?(?:const|let|var)\s+to[A-Z][A-Za-z0-9_]*\s*(?::[^=\n]+)?=/g,
  /(?:^|\n)\s*(?:export\s+)?function\s+to[A-Z][A-Za-z0-9_]*\s*\(/g,
] as const;
