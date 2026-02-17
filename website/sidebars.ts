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
      label: 'Guides',
      items: [
        'core/getting-started',
        'core/for-managers',
        'core/for-frontend-developers',
        'core/for-backend-developers',
        'core/for-fullstack-developers',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      items: [
        'packages/index',
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
            'schema/field-resolver',
            'schema/schema-factory',
            'schema/type-guards',
          ],
        },
        'packages/client',
        'packages/client-ws-transport',
        'packages/node-ws-transport',
        'packages/dlq-module',
        'packages/config',
        'packages/cli',
      ],
    },
    {
      type: 'category',
      label: 'Contribution',
      link: {
        type: 'doc',
        id: 'core/governance',
      },
      items: [
        'core/coding-style-guide',
        'core/definition-of-done',
        'core/project-context',
        'core/change-history',
        'core/examples-and-apps',
        'core/generators',
        'core/testing-and-quality',
        'core/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Core Concepts',
      items: [
        'core/why-livon-exists',
        'core/validated-by-default',
        'core/parse-vs-typed',
        'core/backend-frontend-symmetry',
        'core/schema-doc-and-generated-jsdoc',
        'core/how-livon-differs',
        'core/when-not-to-use-livon',
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
      label: 'Legal',
      items: [
        'legal/privacy',
        'legal/imprint',
      ],
    }
  ],
};

export default sidebars;
