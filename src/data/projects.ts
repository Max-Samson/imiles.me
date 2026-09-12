import type { Locale } from '@/lib/i18n';

/** 项目状态:进行中 / 开发中 / 已归档 */
export type ProjectStatus = 'active' | 'wip' | 'archived';

/** 技术栈条目:name 显示名,icon 为 react-simple-icons 的 key(如 'go'、'react') */
export interface ProjectTech {
  name: string;
  icon: string;
}

/** 功能特性条目:icon 为 lucide-react 图标名 */
export interface ProjectFeature {
  title: string;
  description: string;
  icon: string;
}

/** 终端演示的一行:type 为 command(命令)或 output(输出) */
export interface TerminalLine {
  type: 'command' | 'output';
  text: string;
}

/** 终端风格演示配置(kind: 'terminal') */
export interface TerminalDemoConfig {
  kind: 'terminal';
  title?: string;
  lines: TerminalLine[];
}

/** 图片墙演示配置(kind: 'image') */
export interface ImageShowcaseConfig {
  kind: 'image';
  images: { src: string; alt: string; caption?: string; fit?: 'cover' | 'contain' }[];
}

/** 演示配置:终端模拟 或 图片展示,二选一 */
export type DemoConfig = TerminalDemoConfig | ImageShowcaseConfig;

/** 项目多语言覆盖(可选字段,缺省时回退到顶层字段) */
export interface ProjectLocalization {
  title?: string;
  tagline?: string;
  description?: string;
  features?: ProjectFeature[];
  demo?: DemoConfig;
  tags?: string[];
  pageLabel?: string;
  coverImage?: string;
}

/**
 * 项目条目结构(驱动 /projects 列表与详情页)。
 * - slug: 唯一标识,同时作为详情页 URL(/projects/<slug>)
 * - status: 项目状态
 * - githubUrl / pageUrl: 仓库与线上地址
 * - tech / features: 技术栈与功能特性
 * - hasDetailPage: 是否生成独立详情页
 * - demo: 详情页演示(终端/图片)
 * - coverImage: 项目专属展位封面大图(全屏轮播铺满)
 * - locales: 各语言覆盖内容(zh/en)
 * - llms: 是否纳入 llms.txt 索引
 * - tags: 功能/主题标签列表(支持前端 UI 呈现)
 */
export interface Project {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  status: ProjectStatus;
  githubUrl: string;
  pageUrl?: string;
  pageLabel?: string;
  coverImage?: string;
  tech: ProjectTech[];
  features: ProjectFeature[];
  hasDetailPage: boolean;
  demo?: DemoConfig;
  locales?: Partial<Record<Locale, ProjectLocalization>>;
  llms?: boolean;
  tags?: string[];
}

export const projects: Project[] = [
  {
    slug: 'mtimer',
    title: 'MTimer',
    tagline: 'Wails-powered Pomodoro desktop app with AI planning',
    description:
      'MTimer is a cross-platform desktop focus app built around the Pomodoro Technique. It packages a Go backend and Vue 3 frontend into a native desktop experience with Wails, combining standard Pomodoro and custom focus modes, task management, focus session history, white noise and background music, analytics dashboards, and an AI planning assistant that can connect to DeepSeek or any OpenAI-compatible API. SQLite stores tasks, sessions, daily stats, and event stats, while Pinia coordinates timer, task, and settings state on the frontend and ECharts powers the visual reports.',
    status: 'active',
    githubUrl: 'https://github.com/Max-Samson/MTimer_v2.1.1.0',
    pageUrl: 'https://mtimerpage.pages.dev/',
    coverImage: '/projects/mtimer/mtimer-cover.jpeg',
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
    tags: [
      'pomodoro',
      'focus-timer',
      'wails',
      'desktop-app',
      'ai-planning',
      'vue3',
      'sqlite',
      'echarts',
      'productivity',
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
        coverImage: '/projects/mtimer/mtimer-cover-zh.jpeg',
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
  {
    slug: 'dsh-usage-chart',
    title: 'dsh-usage-chart',
    tagline: 'Real-time token usage, cost, and balance dashboard plugin for DeepSeek Harness Web',
    description:
      'dsh-usage-chart is an open-source usage, cost, and account-balance dashboard plugin engineered for DeepSeek Harness (DSH) Web. It mounts an active metric indicator directly below the conversation composer and unfolds into an interactive, zero-dependency SVG chart dashboard. The plugin tracks input (uncached and cache-hit) and output tokens, context pressure, and DeepSeek account balance in real time. It calculates costs using official dual-currency (CNY / USD) list prices across peak and off-peak billing tiers without inaccurate FX conversions, supports custom pricing.json overrides, and provides detailed per-round attribution for duration, TTFT, TPS, cost anomalies, and compaction diagnostics.',
    status: 'active',
    githubUrl: 'https://github.com/Max-Samson/dsh-usage-chart',
    pageUrl: 'https://www.npmjs.com/package/dsh-usage-chart',
    pageLabel: 'View on npm',
    coverImage: '/projects/dsh-usage-chart/dsh-usage-chart-cover.jpeg',
    tech: [
      { name: 'TypeScript', icon: 'typescript' },
      { name: 'React 18', icon: 'react' },
      { name: 'Cordis', icon: 'cordis' },
      { name: 'Node.js', icon: 'nodedotjs' },
      { name: 'esbuild', icon: 'esbuild' },
      { name: 'SVG', icon: 'svg' },
    ],
    tags: [
      'ai-cost',
      'awesome',
      'awesome-dsh-plugin',
      'data-visualization',
      'deepseek',
      'deepseek-api',
      'deepseek-harness',
      'developer-tools',
      'dsh',
      'dsh-plugin',
      'token-usage',
    ],
    features: [
      {
        title: 'Live Indicator & Zero-Dependency SVG',
        description:
          'Mounts a compact live token, cost, and balance indicator below the conversation composer, expanding into a responsive, zero-dependency SVG visualization dashboard without heavy third-party chart libraries.',
        icon: 'BarChart3',
      },
      {
        title: 'Peak / Off-Peak & Dual-Currency Billing',
        description:
          'Calculates expenses using official CNY and USD list prices across weekday peak (2x rate) and off-peak tiers without currency conversion distortion, with support for user-defined pricing.json overrides and unpriced model warnings.',
        icon: 'Tag',
      },
      {
        title: 'Per-Round Cost & Source Attribution',
        description:
          'Provides total, composition, and cost views with per-bar monetary values, duration overlays, cost spike anomaly markers, and explainer tooltips attributing inputs to human prompt, agent tool, or continuation.',
        icon: 'Layers',
      },
      {
        title: 'Context Breakdown & Compaction Diagnostics',
        description:
          'Deconstructs context occupancy into system prompts, tool definitions, and message history with segmented color bars, folding compaction events to reveal freed tokens and proactively warn against context overflow.',
        icon: 'Activity',
      },
      {
        title: 'Secure Account Balance Tracking',
        description:
          'Queries official DeepSeek account balance in real time via host-side proxy, ensuring API keys are securely resolved from DSH credentials or environment variables without browser exposure.',
        icon: 'Shield',
      },
      {
        title: 'Dual-Environment Bundle Architecture',
        description:
          'Engineered on the Cordis plugin framework and compiled with esbuild into a dual-target architecture: Node ESM on the host side and zero-overhead browser bundles matching DSH Web platform modules.',
        icon: 'Cpu',
      },
    ],
    hasDetailPage: true,
    llms: true,
    locales: {
      zh: {
        pageLabel: '查看 npm',
        coverImage: '/projects/dsh-usage-chart/dsh-usage-chart-cover-zh.jpeg',
        tagline: 'DeepSeek 用量 / 成本 / 余额仪表盘 · DSH Web 插件',
        description:
          'dsh-usage-chart 是专为 DeepSeek Harness (DSH) Web 设计的高性能用量、成本与账户余额监控插件。它在输入框下方嵌入紧凑的实时指标指示器，并支持展开零依赖手绘 SVG 用量可视化面板。插件直接消费官方 adapter 投影数据，精准展示未命中/命中输入 Token、输出 Token、缓存命中率与上下文占用；内置官方高峰/空闲双时段刊例价，支持 CNY/USD 双币种直接计费与 pricing.json 覆盖；提供逐轮耗时、TTFT、TPS、成本突增异常标记、输入来源归因（人工/Agent/续跑）以及上下文构成与折叠压缩诊断，余额查询直连官方接口并由宿主安全代理。',
        features: [
          {
            title: '输入框指示器与零依赖 SVG 图表',
            description:
              '在输入框下方常驻展示实时 Token、成本、模型与账户余额，展开后呈现精细的零依赖 SVG 自绘图表，不引入任何冗余第三方图表库，保持体积最小与轻量稳定。',
            icon: 'BarChart3',
          },
          {
            title: '高峰/空闲时段与官方双币种计费',
            description:
              '内置官方周一至周五高峰时段（2倍费率）与空闲时段计费规则，支持 CNY 与 USD 双币种官方刊例价直接核算与一键切换，并支持 pricing.json 覆盖与未定价模型明确告警。',
            icon: 'Tag',
          },
          {
            title: '逐轮成本分析与输入来源归因',
            description:
              '支持总量、构成、成本三视角分析，每根柱状图直显对应轮次费用，叠加总耗时点线与异常突增标记，悬浮卡片完整解析 TTFT、TPS 以及人工/Agent/续跑输入来源归因。',
            icon: 'Layers',
          },
          {
            title: '上下文拆解与压缩折叠诊断',
            description:
              '将上下文分解为系统提示词、工具定义与历史消息三段细分占比，结合宿主 compaction 压缩事件流展示释放 Token 数与摘要成本，在容量超标时给出前置优化建议。',
            icon: 'Activity',
          },
          {
            title: '安全可靠的官方余额实时查询',
            description:
              '通过宿主侧安全代理直连 DeepSeek 官方 /user/balance 接口查询余额，API Key 优先从 DSH 凭据服务或环境变量动态解析，杜绝浏览器前端密钥泄露风险。',
            icon: 'Shield',
          },
          {
            title: '宿主与客户端双半区架构',
            description:
              '基于 Cordis 插件模型与 React 18 构建，通过 esbuild 分别打包为 Node ESM 宿主后端与匹配平台运行时规范的前端工厂包，无缝嵌入 DSH Web 生态。',
            icon: 'Cpu',
          },
        ],
      },
    },
  },
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
