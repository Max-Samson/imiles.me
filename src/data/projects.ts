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
  images: { src: string; alt: string; caption?: string }[];
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
}

/**
 * 项目条目结构(驱动 /projects 列表与详情页)。
 * - slug: 唯一标识,同时作为详情页 URL(/projects/<slug>)
 * - status: 项目状态
 * - githubUrl / pageUrl: 仓库与线上地址
 * - tech / features: 技术栈与功能特性
 * - hasDetailPage: 是否生成独立详情页
 * - demo: 详情页演示(终端/图片)
 * - locales: 各语言覆盖内容(zh/en)
 * - llms: 是否纳入 llms.txt 索引
 */
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
  llms?: boolean;
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
