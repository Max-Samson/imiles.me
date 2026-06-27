import type { Locale } from '@/lib/i18n';

export type ProjectStatus = 'active' | 'wip' | 'archived';

export interface ProjectTech {
  name: string;
  icon: string; // react-simple-icons key (e.g. 'go', 'react')
}

export interface ProjectFeature {
  title: string;
  description: string;
  icon: string; // lucide-react icon name
}

export interface TerminalLine {
  type: 'command' | 'output';
  text: string;
}

export interface TerminalDemoConfig {
  kind: 'terminal';
  title?: string;
  lines: TerminalLine[];
}

export interface ImageShowcaseConfig {
  kind: 'image';
  images: { src: string; alt: string; caption?: string }[];
}

export type DemoConfig = TerminalDemoConfig | ImageShowcaseConfig;

export interface ProjectLocalization {
  title?: string;
  tagline?: string;
  description?: string;
  features?: ProjectFeature[];
  demo?: DemoConfig;
}

export interface Project {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  githubUrl: string;
  pageUrl?: string;
  tech: ProjectTech[];
  features: ProjectFeature[];
  hasDetailPage: boolean;
  demo?: DemoConfig;
  locales?: Partial<Record<Locale, ProjectLocalization>>;
  // Optional flag indicating if the project is related to LLMs (Large Language Models)
  llms?: boolean;
}

export const projects: Project[] = [
  // {
  //   slug: 'dotfiles',
  //   title: 'Dotfiles',
  //   tagline: 'Cross-platform dev environment via chezmoi + Nix',
  //   description:
  //     'A portable, reproducible development environment managed by chezmoi and Nix flakes. Includes 13 composable dev shells, agent skills for AI tools (Claude Code, Codex, Gemini, Copilot), terminal configuration, and automated bootstrap for macOS and Linux.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/dotfiles',
  //   tech: [
  //     { name: 'Nix', icon: 'nixos' },
  //     { name: 'Lua', icon: 'lua' },
  //     { name: 'Shell', icon: 'gnubash' },
  //   ],
  //   features: [
  //     {
  //       title: 'Nix Dev Shells',
  //       description:
  //         '13 composable, reproducible development shells — one per language, all shareable via flakes.',
  //       icon: 'Boxes',
  //     },
  //     {
  //       title: 'Agent Skills',
  //       description:
  //         'Portable standards distributed to Claude Code, Codex, Gemini, and Copilot via npx skills.',
  //       icon: 'Brain',
  //     },
  //     {
  //       title: 'Cross-Platform',
  //       description:
  //         'chezmoi templates adapt to macOS and Linux with platform-specific guards and feature flags.',
  //       icon: 'Monitor',
  //     },
  //     {
  //       title: 'One-Command Bootstrap',
  //       description:
  //         'Single script installs Nix, chezmoi, and applies the full environment from scratch.',
  //       icon: 'Terminal',
  //     },
  //     {
  //       title: 'Neovim Config',
  //       description: 'Full Lua-based Neovim setup with LSP, tree-sitter, and plugin management.',
  //       icon: 'Code',
  //     },
  //     {
  //       title: 'Automated Maintenance',
  //       description:
  //         'chezmoi hooks auto-install packages, generate completions, and check flake freshness.',
  //       icon: 'RefreshCw',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  // },
  // {
  //   slug: 'resume-generator',
  //   title: 'Resume Generator',
  //   tagline: 'Data-driven resumes with AI assessment',
  //   description:
  //     'A data-driven CLI tool that converts YAML, JSON, or TOML resume data into polished PDFs, DOCX, HTML, LaTeX, and Markdown — with multi-agent AI assessment via Ollama for automated resume feedback and scoring.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/resume-generator',
  //   tech: [
  //     { name: 'Go', icon: 'go' },
  //     { name: 'Cobra', icon: 'go' },
  //     { name: 'Ollama', icon: 'ollama' },
  //   ],
  //   features: [
  //     {
  //       title: 'Multi-Format Input',
  //       description: 'Define your resume in YAML, JSON, or TOML — whichever fits your workflow.',
  //       icon: 'FileInput',
  //     },
  //     {
  //       title: 'Rich Output Formats',
  //       description: 'Export to PDF, HTML, DOCX, LaTeX, or Markdown with a single command.',
  //       icon: 'FileOutput',
  //     },
  //     {
  //       title: 'AI Assessment',
  //       description:
  //         'Multi-agent AI evaluation via Ollama provides automated feedback and scoring on your resume.',
  //       icon: 'Brain',
  //     },
  //     {
  //       title: 'CLI First',
  //       description:
  //         'Powerful command-line interface via Cobra for scripting and CI/CD integration.',
  //       icon: 'Terminal',
  //     },
  //     {
  //       title: 'Template Engine',
  //       description: 'Go template system with custom functions for flexible resume layouts.',
  //       icon: 'Layout',
  //     },
  //     {
  //       title: 'Agent Skill',
  //       description: 'Usable as an agent skill for integration into AI-powered workflows.',
  //       icon: 'Zap',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  // },
  {
    slug: 'mtimer',
    title: 'MTimer',
    tagline: 'Wails-powered Pomodoro desktop app with AI planning',
    description:
      'MTimer is a cross-platform desktop focus app built around the Pomodoro Technique. It packages a Go backend and Vue 3 frontend into a native desktop experience with Wails, combining standard Pomodoro and custom focus modes, task management, focus session history, white noise and background music, analytics dashboards, and an AI planning assistant that can connect to DeepSeek or any OpenAI-compatible API. SQLite stores tasks, sessions, daily stats, and event stats, while Pinia coordinates timer, task, and settings state on the frontend and ECharts powers the visual reports.',
    status: 'active',
    githubUrl: 'https://github.com/Max-Samson/MTimer_v2.1.1.0',
    pageUrl: 'https://mtimerpage.pages.dev/',
    tech: [
      { name: 'Go', icon: 'go' },
      { name: 'Wails', icon: 'wails' },
      { name: 'Vue 3', icon: 'vue' },
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'SQLite', icon: 'sqlite' },
      { name: 'ECharts', icon: 'echarts' },
      { name: 'Tailwind CSS', icon: 'tailwindcss' },
      { name: 'Vite', icon: 'vite' },
    ],
    features: [
      {
        title: 'Dual Focus Modes',
        description:
          'Supports both standard Pomodoro sessions and custom focus modes, with per-task work, short-break, and long-break settings that can change without interrupting the active timer.',
        icon: 'Settings',
      },
      {
        title: 'Persistent Tasks and Sessions',
        description:
          'The Go backend exposes task CRUD and focus-session APIs through Wails, storing todos, focus_sessions, daily_stats, and event_stats in SQLite.',
        icon: 'Database',
      },
      {
        title: 'Transactional Stats Updates',
        description:
          'Completed sessions update session records, daily summaries, and event stats in one transaction, with startup recalculation to repair recent historical data.',
        icon: 'RefreshCw',
      },
      {
        title: 'AI Planning Assistant',
        description:
          'The assistant supports task planning, daily chat, and study guidance modes, calling DeepSeek or a custom Base URL and extracting JSON task plans into todos.',
        icon: 'Brain',
      },
      {
        title: 'Focus Analytics',
        description:
          'ECharts renders daily summaries, Pomodoro trends, time-of-day distribution, task completion rate, and workload trends, with PNG export support.',
        icon: 'BarChart3',
      },
      {
        title: 'Immersive Audio',
        description:
          'Includes timer-complete sounds, button feedback, white noise, and background music playlists, with preferences persisted through Pinia and localStorage.',
        icon: 'Activity',
      },
    ],
    hasDetailPage: true,
    llms: true,
    demo: {
      kind: 'image',
      images: [
        {
          src: '/projects/mtimer/mtimer-index.png',
          alt: 'MTimer home screen with focus timer and task controls',
          caption: 'Home',
        },
        {
          src: '/projects/mtimer/stat-daily.png',
          alt: 'MTimer daily statistics dashboard',
          caption: 'Daily Stats',
        },
        {
          src: '/projects/mtimer/stat-pomo.png',
          alt: 'MTimer pomodoro trend statistics',
          caption: 'Pomodoro Stats',
        },
        {
          src: '/projects/mtimer/stat-task.png',
          alt: 'MTimer task completion statistics',
          caption: 'Task Stats',
        },
        {
          src: '/projects/mtimer/todo_music.png',
          alt: 'MTimer task list and music player screen',
          caption: 'Quiet Music Player',
        },
        {
          src: '/projects/mtimer/ai-helper.png',
          alt: 'MTimer AI planning helper screen',
          caption: 'AI Time Planning Assistant',
        },
      ],
    },
    locales: {
      zh: {
        tagline: '基于 Wails 的番茄钟桌面应用，内置 AI 时间规划',
        description:
          'MTimer 是一个围绕番茄工作法构建的跨平台桌面专注工具。项目使用 Wails 将 Go 后端与 Vue 3 前端打包为原生桌面应用，提供番茄/自定义双专注模式、任务清单、专注会话记录、白噪音与背景音乐、统计可视化，以及可接入 DeepSeek 或自定义 OpenAI-compatible API 的 AI 时间规划助手。后端通过 SQLite 保存任务、会话、每日统计与事件统计，并在会话完成时用事务同步更新统计数据；前端用 Pinia 管理计时器、任务和设置状态，用 ECharts 展示每日汇总、番茄趋势、任务完成率与时段分布。',
        features: [
          {
            title: '双专注模式',
            description:
              '内置标准番茄钟和自定义专注模式，任务可以拥有独立的工作、短休息和长休息设置，切换全局模式时不会打断正在进行的计时。',
            icon: 'Settings',
          },
          {
            title: '任务与会话持久化',
            description:
              'Go 后端通过 Wails 暴露任务 CRUD、专注会话开始/完成等 API，并用 SQLite 保存 todos、focus_sessions、daily_stats 和 event_stats。',
            icon: 'Database',
          },
          {
            title: '事务化统计更新',
            description:
              '完成专注会话时在事务中同步写入会话、每日统计和事件统计；应用启动后还会自动回算最近 30 天，修复历史统计数据。',
            icon: 'RefreshCw',
          },
          {
            title: 'AI 时间规划助手',
            description:
              'AI 助手支持任务规划、日常对话和学习辅导模式，可调用 DeepSeek 或自定义 Base URL，并从回复 JSON 中提取任务计划自动创建待办。',
            icon: 'Brain',
          },
          {
            title: '专注数据可视化',
            description:
              '统计模块用 ECharts 展示每日汇总、番茄趋势、时段分布、任务完成率和工作负载趋势，并支持图表导出为 PNG。',
            icon: 'BarChart3',
          },
          {
            title: '沉浸式音频体验',
            description:
              '内置计时结束音效、按钮音效、白噪音和背景音乐播放列表，设置通过 Pinia 与 localStorage 持久化。',
            icon: 'Activity',
          },
        ],
        demo: {
          kind: 'image',
          images: [
            {
              src: '/projects/mtimer/mtimer-index.png',
              alt: 'MTimer 首页，展示专注计时器和任务控制',
              caption: 'MTimer 首页',
            },
            {
              src: '/projects/mtimer/stat-daily.png',
              alt: 'MTimer 每日统计仪表盘',
              caption: '每日统计',
            },
            {
              src: '/projects/mtimer/stat-pomo.png',
              alt: 'MTimer 番茄趋势统计',
              caption: '番茄统计',
            },
            {
              src: '/projects/mtimer/stat-task.png',
              alt: 'MTimer 任务完成统计',
              caption: '任务统计',
            },
            {
              src: '/projects/mtimer/todo_music.png',
              alt: 'MTimer 任务列表和音乐播放器界面',
              caption: '白噪声音乐播放器',
            },
            {
              src: '/projects/mtimer/ai-helper.png',
              alt: 'MTimer AI 时间规划助手界面',
              caption: 'AI 时间规划助手',
            },
          ],
        },
      },
    },
  },
  // {
  //   slug: 'semantic-release',
  //   title: 'Semantic Release',
  //   tagline: 'Trunk-based semantic versioning CLI',
  //   description:
  //     'A configurable trunk-based semantic release CLI for Rust — analyzes conventional commits, determines version bumps, generates changelogs, creates git tags, and publishes GitHub releases.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/semantic-release',
  //   tech: [{ name: 'Rust', icon: 'rust' }],
  //   features: [
  //     {
  //       title: 'Conventional Commits',
  //       description:
  //         'Parses commit messages following the conventional commits spec to determine version bumps.',
  //       icon: 'GitBranch',
  //     },
  //     {
  //       title: 'Semantic Versioning',
  //       description: 'Automatically calculates the next semver version based on commit types.',
  //       icon: 'Tag',
  //     },
  //     {
  //       title: 'Changelog Generation',
  //       description: 'Produces structured changelogs from your commit history.',
  //       icon: 'FileText',
  //     },
  //     {
  //       title: 'Dry Run Mode',
  //       description: 'Preview what would happen without making any changes using `sr plan`.',
  //       icon: 'Zap',
  //     },
  //     {
  //       title: 'Configurable Rules',
  //       description:
  //         'Customize version bump rules and changelog formatting to match your workflow.',
  //       icon: 'Settings',
  //     },
  //     {
  //       title: 'CI/CD Ready',
  //       description: 'Designed for automation — runs headlessly in any CI pipeline.',
  //       icon: 'Code',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  //   demo: {
  //     kind: 'terminal',
  //     title: 'semantic-release',
  //     lines: [
  //       { type: 'command', text: 'sr plan' },
  //       { type: 'output', text: 'Analyzing commits since v1.2.0...' },
  //       { type: 'output', text: '' },
  //       { type: 'output', text: '  feat: add JSON schema validation  → minor' },
  //       { type: 'output', text: '  fix: handle empty commit bodies   → patch' },
  //       { type: 'output', text: '  feat!: redesign config format      → major' },
  //       { type: 'output', text: '' },
  //       { type: 'output', text: 'Next version: v2.0.0 (major)' },
  //       { type: 'output', text: '' },
  //       { type: 'command', text: 'sr release' },
  //       { type: 'output', text: 'Creating tag v2.0.0...' },
  //       { type: 'output', text: 'Generating CHANGELOG.md...' },
  //       { type: 'output', text: '✓ Released v2.0.0' },
  //     ],
  //   },
  // },
  // {
  //   slug: 'github-metrics',
  //   title: 'GitHub Metrics',
  //   tagline: 'Visualize your GitHub activity',
  //   description:
  //     'A TypeScript tool that collects and visualizes GitHub contribution metrics and activity data. Generates beautiful SVG charts showing language usage, expertise areas, contribution pulse, and more — perfect for embedding in your profile README.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/github-metrics',
  //   tech: [
  //     { name: 'TypeScript', icon: 'typescript' },
  //     { name: 'Node.js', icon: 'nodedotjs' },
  //     { name: 'GitHub Actions', icon: 'githubactions' },
  //   ],
  //   features: [
  //     {
  //       title: 'Language Breakdown',
  //       description: 'Visualize your most-used programming languages across all repositories.',
  //       icon: 'BarChart3',
  //     },
  //     {
  //       title: 'Contribution Pulse',
  //       description: 'Track your contribution activity over time with pulse charts.',
  //       icon: 'Activity',
  //     },
  //     {
  //       title: 'Expertise Areas',
  //       description: 'Identify and display your areas of technical expertise.',
  //       icon: 'Layers',
  //     },
  //     {
  //       title: 'SVG Output',
  //       description: 'Generates crisp, scalable SVG charts that look great everywhere.',
  //       icon: 'Image',
  //     },
  //     {
  //       title: 'GitHub Actions',
  //       description: 'Runs automatically via GitHub Actions to keep metrics up to date.',
  //       icon: 'RefreshCw',
  //     },
  //     {
  //       title: 'Profile Ready',
  //       description: 'Embed directly in your GitHub profile README for instant visibility.',
  //       icon: 'Github',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  //   demo: {
  //     kind: 'image',
  //     images: [
  //       {
  //         src: '/projects/github-metrics/metrics-languages.svg',
  //         alt: 'Language usage chart',
  //         caption: 'Languages',
  //       },
  //       {
  //         src: '/projects/github-metrics/metrics-expertise.svg',
  //         alt: 'Expertise areas chart',
  //         caption: 'Expertise',
  //       },
  //       {
  //         src: '/projects/github-metrics/metrics-pulse.svg',
  //         alt: 'Contribution pulse chart',
  //         caption: 'Pulse',
  //       },
  //       {
  //         src: '/projects/github-metrics/metrics-contributions.svg',
  //         alt: 'Contributions chart',
  //         caption: 'Contributions',
  //       },
  //     ],
  //   },
  // },
  // {
  //   slug: 'openapi-generator',
  //   title: 'OpenAPI Generator',
  //   tagline: 'OpenAPI 3.x to TypeScript & React code generator',
  //   description:
  //     'A Rust-powered code generator that turns OpenAPI 3.x specs into zero-dependency TypeScript clients, SWR hooks, and SSE streaming utilities for React applications.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/openapi-generator',
  //   tech: [
  //     { name: 'Rust', icon: 'rust' },
  //     { name: 'TypeScript', icon: 'typescript' },
  //     { name: 'React', icon: 'react' },
  //   ],
  //   features: [
  //     {
  //       title: 'Zero-Dependency Clients',
  //       description: 'Generates fully typed TypeScript clients with no runtime dependencies.',
  //       icon: 'Code',
  //     },
  //     {
  //       title: 'SWR Hooks',
  //       description: 'Auto-generates React SWR hooks for data fetching from your API spec.',
  //       icon: 'RefreshCw',
  //     },
  //     {
  //       title: 'SSE Streaming',
  //       description: 'Built-in support for server-sent events streaming in generated code.',
  //       icon: 'Radio',
  //     },
  //     {
  //       title: 'OpenAPI 3.x',
  //       description: 'Full support for OpenAPI 3.0 and 3.1 specifications.',
  //       icon: 'FileText',
  //     },
  //     {
  //       title: 'Type Safety',
  //       description: 'Produces fully typed code with proper interfaces and validation.',
  //       icon: 'Shield',
  //     },
  //     {
  //       title: 'Fast Generation',
  //       description: 'Rust-powered core for blazing fast code generation even on large specs.',
  //       icon: 'Zap',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  //   demo: {
  //     kind: 'image',
  //     images: [
  //       {
  //         src: '/projects/openapi-generator/demo.gif',
  //         alt: 'OpenAPI Generator CLI demo showing code generation workflow',
  //         caption: 'CLI Workflow',
  //       },
  //     ],
  //   },
  // },
  // {
  //   slug: 'linear-gp',
  //   title: 'Linear Genetic Programming Framework',
  //   tagline: 'Production-grade Rust framework for LGP research',
  //   description:
  //     'A production-grade Rust framework for linear genetic programming research, featuring modular architecture, Q-Learning integration, automated hyperparameter optimization, and support for reinforcement learning and classification tasks. Includes Rayon-powered parallel fitness evaluation, Optuna optimization backed by PostgreSQL, and Python CLI tools for batch experiments, visualization, and statistical analysis.',
  //   status: 'active',
  //   githubUrl: 'https://github.com/urmzd/linear-gp',
  //   tech: [
  //     { name: 'Rust', icon: 'rust' },
  //     { name: 'Python', icon: 'python' },
  //     { name: 'Docker', icon: 'docker' },
  //     { name: 'PostgreSQL', icon: 'postgresql' },
  //   ],
  //   features: [
  //     {
  //       title: 'Trait-Based Architecture',
  //       description:
  //         'Modular design using Rust traits — swap genetic operators, fitness functions, and selection strategies without changing core logic.',
  //       icon: 'Layers',
  //     },
  //     {
  //       title: 'Parallel Evaluation',
  //       description:
  //         'Rayon-powered parallel fitness evaluation for fast population processing across all available cores.',
  //       icon: 'Cpu',
  //     },
  //     {
  //       title: 'Hyperparameter Optimization',
  //       description:
  //         'Optuna integration with PostgreSQL backend for systematic hyperparameter search across experiments.',
  //       icon: 'Settings',
  //     },
  //     {
  //       title: 'Q-Learning Integration',
  //       description:
  //         'Built-in Q-Learning support for reinforcement learning tasks alongside classification experiments.',
  //       icon: 'Brain',
  //     },
  //     {
  //       title: 'Experiment Visualization',
  //       description:
  //         'Python CLI tools for generating plots of fitness, diversity, and convergence across generations.',
  //       icon: 'BarChart3',
  //     },
  //     {
  //       title: 'Dockerized Workflows',
  //       description:
  //         'Docker Compose setup for reproducible experiments with PostgreSQL and batch processing out of the box.',
  //       icon: 'Server',
  //     },
  //   ],
  //   hasDetailPage: true,
  //   llms: false,
  //   demo: {
  //     kind: 'image',
  //     images: [
  //       {
  //         src: '/projects/linear-gp/iris_baseline.png',
  //         alt: 'Iris baseline experiment results',
  //         caption: 'Baseline',
  //       },
  //       {
  //         src: '/projects/linear-gp/iris_crossover.png',
  //         alt: 'Iris crossover experiment results',
  //         caption: 'Crossover',
  //       },
  //       {
  //         src: '/projects/linear-gp/iris_mutation.png',
  //         alt: 'Iris mutation experiment results',
  //         caption: 'Mutation',
  //       },
  //       {
  //         src: '/projects/linear-gp/iris_full.png',
  //         alt: 'Iris full experiment results',
  //         caption: 'Full Pipeline',
  //       },
  //     ],
  //   },
  // },
];

export function localizeProject(project: Project, locale: Locale = 'en'): Project {
  const localized = project.locales?.[locale];
  if (!localized) return project;

  return {
    ...project,
    ...localized,
    locales: project.locales,
  };
}

export function getProjects(locale: Locale = 'en'): Project[] {
  return projects.map((project) => localizeProject(project, locale));
}

export function getProject(slug: string, locale: Locale = 'en'): Project | undefined {
  const project = projects.find((p) => p.slug === slug);
  return project ? localizeProject(project, locale) : undefined;
}
