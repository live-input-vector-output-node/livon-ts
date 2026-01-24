import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'doc',
      id: 'index',
      label: 'Overview',
    },
    {
      type: 'category',
      label: 'Main',
      link: {
        type: 'doc',
        id: 'core/what-is-livon',
      },
      items: [
        'core/what-is-livon',
        'core/livon-vs-others',
        'core/for-managers',
        'core/for-frontend-developers',
        'core/for-backend-developers',
        'core/for-fullstack-developers',
        'core/getting-started',
      ],
    },
    {
      type: 'category',
      label: 'Packages',
      link: {
        type: 'doc',
        id: 'packages/index',
      },
      items: [
        'packages/index',
        'packages/runtime',
        'packages/schema',
        {
          type: 'category',
          label: 'Schema APIs',
          link: {
            type: 'doc',
            id: 'schema/index',
          },
          items: [
            'schema/index',
            'schema/type-safety',
            'schema/string',
            'schema/number',
            'schema/boolean',
            'schema/date',
            'schema/enumeration',
            'schema/object',
            'schema/array',
            'schema/tuple',
            'schema/literal',
            'schema/union',
            'schema/or',
            'schema/binary',
            'schema/before',
            'schema/after',
            'schema/and',
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
        'core/governance',
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
      label: 'Technical',
      link: {
        type: 'doc',
        id: 'technical/runtime-design',
      },
      items: [
        'technical/runtime-design',
        'technical/architecture',
        'technical/event-flow',
        'technical/roadmap',
        'technical/custom-schema',
        'technical/custom-module',
      ],
    },
  ],
};

export default sidebars;
