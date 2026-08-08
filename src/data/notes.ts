/**
 * 笔记数据(驱动 /notes 笔记列表与详情页)。
 *
 * 注意:本文件沿用研究条目(ResearchItem)的数据结构,数组名仍是 research,
 * 这是从早期版本继承下来的命名;添加笔记时按该结构新增对象即可。
 * - notePicItems: 详情页顶部展示的图片(可选)
 * - llms: 是否纳入 llms.txt 索引
 */
import type { DemoConfig, ProjectFeature, ProjectTech } from './projects';

export type ResearchCategory = 'paper';

export interface ResearchItem {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: ResearchCategory;
  year: number;
  venue?: string;
  tags: string[];
  githubUrl?: string;
  paperUrl?: string;
  tech: string[];
  hasDetailPage: boolean;
  detailTech?: ProjectTech[];
  features?: ProjectFeature[];
  demo?: DemoConfig;
  notePicItems?: NotePicItems[];
  llms?: boolean;
}

export interface NotePicItems {
  src: string;
  alt: string;
  caption?: string;
}

const NotePicItems: NotePicItems[] = [
  {
    src: '/images/note/javascript-package-managers-comparison.png',
    alt: 'javascript-package-managers-comparison',
    caption: 'javascript-package-managers-comparison',
  },
  // { src: '/images/note/test1.png', alt: 'test1', caption: 'test1' },
  // { src: '/images/note/test2.jpg', alt: 'test2', caption: 'test2' },
  // { src: '/images/note/test3.png', alt: 'JavaScript tooling notes', caption: 'Tooling' },
];
export const research: ResearchItem[] = [
  {
    slug: 'javascript-package-managers-comparison',
    title: 'Bun、pnpm、npm、Yarn 全面对比学习笔记',
    tagline: '从发展历史、底层机制到企业选型，系统理解 JavaScript 包管理器生态',
    description:
      '这篇笔记梳理 npm、Yarn、pnpm 与 Bun 的演进脉络：npm 作为 Node.js 官方标准解决基础依赖安装；Yarn 推动锁文件、并行下载和缓存能力；pnpm 通过内容寻址存储、硬链接、符号链接与严格依赖管理，解决磁盘浪费和幽灵依赖；Bun 则把运行时、包管理、构建和测试整合成一体化工具链。结论是：小项目优先 npm，现代企业项目和 Monorepo 优先 pnpm + Node.js，老项目继续沿用 Yarn，新工具、脚本和 Serverless 场景可渐进尝试 Bun。',
    category: 'paper',
    year: 2026,
    venue: 'JavaScript Tooling Notes',
    tags: ['javascript', 'package-manager', 'nodejs', 'pnpm', 'bun', 'monorepo'],
    tech: ['npm', 'Yarn', 'pnpm', 'Bun', 'Node.js'],
    hasDetailPage: true,
    detailTech: [
      { name: 'npm', icon: 'npm' },
      { name: 'Yarn', icon: 'yarn' },
      { name: 'pnpm', icon: 'pnpm' },
      { name: 'Bun', icon: 'bun' },
      { name: 'Node.js', icon: 'nodedotjs' },
    ],
    notePicItems: NotePicItems,
    features: [
      {
        title: '工具演进脉络',
        description:
          'JavaScript 包管理器的发展本质上是在持续解决安装速度、磁盘占用、依赖一致性、幽灵依赖和工程效率问题。',
        icon: 'GitBranch',
      },
      {
        title: 'npm 与 Yarn',
        description:
          "npm 是官方默认选择，兼容性最好；Yarn Classic 强化锁文件、并行下载和缓存，Yarn Berry 则用 Plug'n'Play 探索无 node_modules 模式。",
        icon: 'Layers',
      },
      {
        title: 'pnpm 核心机制',
        description:
          'pnpm 采用内容寻址存储，全局 store 保存一份依赖，通过 hard link 与 symbolic link 构建 node_modules，减少复制并提升安装速度。',
        icon: 'Database',
      },
      {
        title: '幽灵依赖治理',
        description:
          'npm/Yarn 扁平化 node_modules 可能让未声明依赖被意外 import；pnpm 只暴露 package.json 中显式声明的依赖，从机制上减少隐式风险。',
        icon: 'Shield',
      },
      {
        title: 'Bun 一体化工具链',
        description:
          'Bun 不只是包管理器，还包含 runtime、package manager、bundler 和 test runner；它基于 JavaScriptCore 与 Zig 实现，启动和安装速度很快，但 Node 生态兼容仍需评估。',
        icon: 'Zap',
      },
      {
        title: '企业选型建议',
        description:
          '团队应统一 Node 版本、包管理器和 lock 文件；小项目用 npm，企业项目优先 pnpm，老项目不强行迁移，Bun 适合从 CLI、脚本和测试场景渐进试用。',
        icon: 'Settings',
      },
    ],
    llms: true,
  },
];

export function getResearchItem(slug: string): ResearchItem | undefined {
  return research.find((r) => r.slug === slug);
}
