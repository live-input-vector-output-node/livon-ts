import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Start Here',
      items: [
        'core/getting-started',
        'core/why-livon-exists',
      ],
    },
    {
      type: 'category',
      label: 'Guides',
      items: [
        'core/for-fullstack-developers',
        'core/for-frontend-developers',
        'core/for-backend-developers',
        'core/for-managers',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core/validated-by-default',
        'core/parse-vs-typed',
        'core/backend-frontend-symmetry',
        'core/schema-doc-and-generated-jsdoc',
        'core/when-not-to-use-livon',
      ],
    },
    {
      type: 'category',
      label: 'Reference',
      link: {
        type: 'doc',
        id: 'packages/index',
      },
      items: [
        'packages/runtime',
        'packages/schema',
        {
          type: 'category',
          label: 'Schema APIs',
          items: [
            'schema/index',
            'schema/context',
            'schema/type-safety',
            'schema/string',
            'schema/number',
            'schema/boolean',
            'schema/enumeration',
            'schema/date',
            'schema/array',
            'schema/binary',
            'schema/object',
            'schema/tuple',
            'schema/literal',
            'schema/union',
            'schema/and',
            'schema/or',
            'schema/before',
            'schema/after',
            'schema/api',
            'schema/operation',
            'schema/subscription',
            'schema/field-operation',
            'schema/schema-factory',
            'schema/type-guards',
          ],
        },
        'packages/client',
        'packages/client-ws-transport',
        'packages/node-ws-transport',
        'packages/sync',
        'packages/react',
        'packages/cli',
        'packages/dlq-module',
      ],
    },
    {
      type: 'category',
      label: 'Technical',
      link: {
        type: 'doc',
        id: 'technical/runtime-design',
      },
      items: [
        'technical/architecture',
        'technical/event-flow',
        'technical/roadmap',
        'technical/custom-schema',
        'technical/custom-module',
      ],
    },
    {
      type: 'category',
      label: 'Contribution',
      link: {
        type: 'doc',
        id: 'core/contributing',
      },
      items: [
        'core/testing-and-quality',
        'core/coding-style-guide',
        'core/definition-of-done',
        'core/code-of-conduct',
        'core/support',
        'core/security',
        'core/release-notes',
        'core/governance',
        'core/project-context',
        'core/change-history',
        'core/examples-and-apps',
        'core/generators',
      ],
    },
    {
      type: 'category',
      label: 'AI Control',
      link: {
        type: 'doc',
        id: 'ai/index',
      },
      items: [
        'ai/root-gate',
        'ai/specializations',
        'ai/context-routing',
        'ai/active-rules-and-gates',
        'ai/tool-mapping',
        'ai/approach-and-rationale',
        'ai/multi-agent-council',
      ],
    },
    {
      type: 'category',
      label: 'Legal',
      items: [
        'legal/privacy',
        'legal/imprint',
      ],
    }
  ],
};

export default sidebars;
