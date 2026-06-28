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
  // {
  //   slug: 'linear-gp-thesis',
  //   title: 'Reinforced Linear Genetic Programming',
  //   tagline: 'Using Q-Learning to automate register-action assignments in LGP',
  //   description:
  //     'Proposes Reinforced Linear Genetic Programming (RLGP), a novel hybrid that layers Q-Learning on top of LGP to learn optimal register-action assignments — eliminating the need for manual mapping. Evaluated on OpenAI Gym CartPole-v1 and MountainCar-v0 benchmarks. LGP achieved a mean reward of 454 on CartPole; RLGP solved the task but plateaued early at 213, suggesting the Q-Learning exploration-exploitation balance needs further tuning.',
  //   category: 'paper',
  //   year: 2023,
  //   venue: 'Dalhousie University — Honours Thesis',
  //   tags: [
  //     'genetic programming',
  //     'reinforcement learning',
  //     'evolutionary computation',
  //     'Q-learning',
  //   ],
  //   githubUrl: 'https://github.com/urmzd/linear-gp',
  //   paperUrl: 'https://web.cs.dal.ca/~mheywood/Thesis/UMukhammadnaim.pdf',
  //   tech: ['Rust', 'Python'],
  //   hasDetailPage: true,
  //   detailTech: [
  //     { name: 'Rust', icon: 'rust' },
  //     { name: 'Python', icon: 'python' },
  //   ],
  //   notePicItems: [{ src: '/images/note/mc.jpg', alt: 'mc', caption: 'mc' }],
  //   features: [
  //     {
  //       title: 'Genetic Operators',
  //       description:
  //         'Crossover, mutation, and selection operators for evolving program populations.',
  //       icon: 'Dna',
  //     },
  //     {
  //       title: 'Benchmark Datasets',
  //       description: 'Built-in support for Iris and other standard classification benchmarks.',
  //       icon: 'FlaskConical',
  //     },
  //     {
  //       title: 'Experiment Tracking',
  //       description: 'Track fitness, diversity, and convergence across generations.',
  //       icon: 'BarChart3',
  //     },
  //     {
  //       title: 'Rust Performance',
  //       description: 'Core evolution engine written in Rust for maximum throughput.',
  //       icon: 'Cpu',
  //     },
  //     {
  //       title: 'Python Analysis',
  //       description:
  //         'Python scripting layer for experiment visualization and statistical analysis.',
  //       icon: 'Brain',
  //     },
  //     {
  //       title: 'Configurable Runs',
  //       description: 'Fine-tune population size, mutation rates, and tournament parameters.',
  //       icon: 'Settings',
  //     },
  //   ],
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
  //   llms: false,
  // },
  // {
  //   slug: 'lepus-classifier',
  //   title:
  //     'The Lepus Classifier: Exploring Image Classification with Convolutional Neural Networks',
  //   tagline: 'CNN image classification on a 85-image dataset of rabbits and hares',
  //   description:
  //     'Examines methods to improve CNN performance without large datasets or specialized hardware. Trained on just 85 web-scraped images of Eastern cottontail rabbits and European hares, using Stratified K-Fold Cross Validation to handle the small, unbalanced dataset. Best configuration achieved 0.647 test accuracy (F1 0.575, precision 0.8, recall 0.625) with SGD+momentum and batch size 2. Demonstrates that even with optimal architecture choices and dropout regularization, data quantity remains the fundamental bottleneck.',
  //   category: 'paper',
  //   year: 2022,
  //   venue: 'Dalhousie University — Course Project',
  //   tags: ['computer vision', 'CNN', 'small-dataset learning', 'image classification'],
  //   githubUrl: 'https://github.com/urmzd/lepus-classifier',
  //   paperUrl:
  //     'https://github.com/urmzd/lepus-classifier/blob/main/docs/report-docs/lepus-classifier-report.pdf',
  //   tech: ['Python', 'PyTorch', 'OpenCV'],
  //   hasDetailPage: true,
  //   detailTech: [
  //     { name: 'Python', icon: 'python' },
  //     { name: 'PyTorch', icon: 'pytorch' },
  //     { name: 'OpenCV', icon: 'opencv' },
  //   ],
  //   notePicItems: NotePicItems,
  //   features: [
  //     {
  //       title: 'CNN Architecture',
  //       description:
  //         'Convolutional neural network designed for binary image classification of rabbits vs hares.',
  //       icon: 'Layers',
  //     },
  //     {
  //       title: 'Small-Dataset Learning',
  //       description:
  //         'Techniques for training on just 85 web-scraped images without specialized hardware.',
  //       icon: 'Image',
  //     },
  //     {
  //       title: 'Stratified K-Fold CV',
  //       description:
  //         'Stratified K-Fold Cross Validation to reliably evaluate models on small, unbalanced data.',
  //       icon: 'Shuffle',
  //     },
  //     {
  //       title: 'Web Scraping Pipeline',
  //       description:
  //         'Automated collection of training images of Eastern cottontail rabbits and European hares.',
  //       icon: 'Globe',
  //     },
  //     {
  //       title: 'Dropout Regularization',
  //       description: 'Dropout layers to combat overfitting on the limited training set.',
  //       icon: 'Shield',
  //     },
  //     {
  //       title: 'Hyperparameter Tuning',
  //       description:
  //         'Systematic exploration of optimizers, batch sizes, and architectures for peak accuracy.',
  //       icon: 'Settings',
  //     },
  //   ],
  //   llms: false,
  // },
  // {
  //   slug: 'md-classifier',
  //   title: 'Classification of Ailments Given Description of Symptoms',
  //   tagline: 'CNN-based medical condition prediction from natural language symptom descriptions',
  //   description:
  //     'Addresses the challenge of preliminary medical self-diagnosis by developing a CNN that returns the most probable condition given a natural language symptom description. Compares two preprocessing pipelines — One-Hot Encoding (56x4210 word-stem matrix) and unsupervised FastText embeddings — on data sourced from UpToDate and Mayo Clinic. The One-Hot CNN achieved 90% recall, with perfect precision on migraines and tetanus; FastText underperformed due to semantic information loss during processing.',
  //   category: 'paper',
  //   year: 2022,
  //   venue: 'Dalhousie University — Course Project',
  //   tags: ['NLP', 'medical diagnosis', 'CNN', 'disease classification'],
  //   githubUrl: 'https://github.com/urmzd/md-classifier',
  //   paperUrl: 'https://github.com/urmzd/md-classifier/blob/main/p1.pdf',
  //   tech: ['Python', 'Keras', 'NLTK'],
  //   hasDetailPage: true,
  //   detailTech: [
  //     { name: 'Python', icon: 'python' },
  //     { name: 'Keras', icon: 'keras' },
  //     { name: 'NLTK', icon: 'nltk' },
  //   ],
  //   notePicItems: NotePicItems,
  //   features: [
  //     {
  //       title: 'Symptom-to-Diagnosis CNN',
  //       description:
  //         'CNN that predicts the most probable medical condition from natural language symptom descriptions.',
  //       icon: 'Brain',
  //     },
  //     {
  //       title: 'One-Hot Encoding',
  //       description:
  //         'Word-stem matrix (56x4210) preprocessing pipeline achieving 90% recall with perfect precision on select conditions.',
  //       icon: 'Code',
  //     },
  //     {
  //       title: 'FastText Embeddings',
  //       description:
  //         'Unsupervised FastText word embeddings as an alternative preprocessing pipeline for semantic representation.',
  //       icon: 'FileText',
  //     },
  //     {
  //       title: 'Medical Data Sources',
  //       description:
  //         'Training data sourced from UpToDate and Mayo Clinic for reliable symptom-condition mappings.',
  //       icon: 'FlaskConical',
  //     },
  //     {
  //       title: 'Multi-Class Classification',
  //       description:
  //         'Classifies across multiple medical conditions including migraines, tetanus, and more.',
  //       icon: 'BarChart3',
  //     },
  //     {
  //       title: 'Pipeline Comparison',
  //       description:
  //         'Side-by-side evaluation of One-Hot vs FastText pipelines to identify optimal preprocessing.',
  //       icon: 'Activity',
  //     },
  //   ],
  //   llms: false,
  // },
];

export function getResearchItem(slug: string): ResearchItem | undefined {
  return research.find((r) => r.slug === slug);
}
