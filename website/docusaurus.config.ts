import {themes as prismThemes} from 'prism-react-renderer';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const repository = process.env.GITHUB_REPOSITORY ?? 'live-input-vector-output-node/livon-ts';
const [, projectName] = repository.split('/');
const deployToGithubPages =
  process.env.DOCUSAURUS_GITHUB_PAGES === 'true' || process.env.GITHUB_ACTIONS === 'true';
const rootPackageJson = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')) as {
  version?: string;
};
const currentVersion =
  typeof rootPackageJson.version === 'string' && rootPackageJson.version.length > 0
    ? `v${rootPackageJson.version}`
    : 'v0.0.0';

const config: Config = {
  title: 'LIVON',
  tagline: 'Live Input. Vector Output. Nodes.',
  favicon: 'img/logo-minimal.svg',

  // Future flags, see https://docusaurus.io/docs/api/docusaurus-config#future
  future: {
    v4: true, // Improve compatibility with the upcoming Docusaurus v4
  },

  // Set the production url of your site here
  url: deployToGithubPages ? 'https://live-input-vector-output-node.github.io' : 'http://127.0.0.1:3000',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: deployToGithubPages ? `/${projectName}/` : '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'live-input-vector-output-node', // Usually your GitHub org/user name.
  projectName, // Usually your repo name.

  onBrokenLinks: deployToGithubPages ? 'warn' : 'throw',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],
  plugins: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      {
        indexBlog: false,
        indexDocs: true,
        docsRouteBasePath: 'docs',
        language: ['en'],
        hashed: true,
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
      },
    ],
  ],
  themes: ['@docusaurus/theme-mermaid'],
  markdown: {
    mermaid: true,
  },

  themeConfig: {
    // Replace with your project's social card
    image: 'img/logo-minimal.svg',
    navbar: {
      title: 'LIVON',
      logo: {
        alt: 'LIVON Logo',
        src: 'img/logo-minimal.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/core/why-livon-exists',
          position: 'left',
          label: 'Core Concepts',
        },
        {
          type: 'search',
          position: 'right',
        },
        {
          to: '/docs',
          position: 'right',
          label: currentVersion,
        },
      ],
    },
    footer: {
      style: 'light',
      links: [
        {
          title: 'Docs',
          items: [
            {
              label: 'Overview',
              to: '/docs',
            },
            {
              label: 'Core Concepts',
              to: '/docs/core/why-livon-exists',
            },
            {
              label: 'Technical',
              to: '/docs/technical/architecture',
            },
            {
              label: 'Contribution',
              to: '/docs/core/contributing',
            },
            {
              label: 'Packages',
              to: '/docs/packages/runtime',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} LIVON`,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
