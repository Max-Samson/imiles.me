export const author = {
  // Display name used across SEO metadata, author labels, and generated examples.
  name: 'Miles',

  // Public contact email. Update this once, and components that need author contact
  // information can reuse the same source of truth.
  email: 'maxshuai355@gmail.com',

  // General location used in profile/resume-style examples. This is not used for
  // routing or localization.
  location: {
    city: 'Wuhan',
    country: 'China',
  },

  // Canonical site identity used by SEO helpers and Open Graph metadata.
  site: {
    name: 'imiles.me',
    url: 'https://imiles.me',
  },

  // Public social accounts. Keep both the full URL and display-only URL because
  // UI links need href values, while resume/code examples often look better
  // without the protocol.
  social: {
    github: {
      username: 'Max-Samson',
      url: 'https://github.com/Max-Samson',
      displayUrl: 'github.com/Max-Samson',
    },
    x: {
      username: 'y7732772614744',
      handle: '@y7732772614744',
      url: 'https://x.com/y7732772614744',
      displayUrl: 'x.com/y7732772614744',
    },
  },

  // Project repository shortcuts used by components that render project-specific
  // CTAs. For example, ArchitectureFlow uses resumeGenerator.url for its
  // "View on GitHub" button and resumeGenerator.releasesUrl for its
  // "Download Release" button. If the project does not exist, replace these
  // with a real repository or remove the consuming CTA from that component.
  // 项目组件按钮用的仓库链接，比如 ArchitectureFlow 的 GitHub / Release 按钮
  repositories: {
    resumeGenerator: {
      url: 'https://github.com/Max-Samson/resume-generator',
      releasesUrl: 'https://github.com/Max-Samson/resume-generator/releases',
    },
  },
} as const;

export type Author = typeof author;
