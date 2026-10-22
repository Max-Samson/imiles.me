/** 现有项目组件的编辑台配置；只声明元数据，不加载组件动画或浏览器副作用。 */
export interface ContentComponentField {
  name: string;
  label: string;
  control: 'text' | 'url' | 'color' | 'select' | 'source';
  required?: boolean;
  placeholder?: string;
  options?: Record<string, string>;
}

export type ComponentCategory = '文字与链接' | '内容容器' | '展示组件';

export interface ContentComponentConfig {
  name: string;
  label: string;
  category: ComponentCategory;
  description: string;
  source: string;
  defaultExport: boolean;
  kind: 'text' | 'flow';
  hasChildren: boolean;
  /** 关闭后不开放属性配置，但仍识别旧文档节点，避免内容丢失。 */
  enabled: boolean;
  /** 支持程度：普通表单可配置，或需要源码配置 */
  supportLevel: 'configurable' | 'source';
  /** 默认插入属性 */
  defaultProps?: Record<string, string>;
  /** 默认插入子内容 */
  defaultChildren?: string;
  /** 允许插入的集合（故事 stories 为纯文本 Markdown，不开放组件插入） */
  collections?: Array<'blog' | 'stories'>;
  fields: ContentComponentField[];
  /** 从属性和子内容中生成实例摘要 */
  extractSummary?: (props: Record<string, string>, childrenText: string) => string;
}

/** 当前正文实际使用的全部 5 个组件。新增接入只需在这里声明已有组件。 */
export const contentComponents: ContentComponentConfig[] = [
  {
    name: 'Highlighter',
    label: '高亮文字',
    category: '文字与链接',
    description: '强调指定文字，支持高亮、下划线、边框等多种手绘效果',
    source: '@/registry/magicui/highlighter',
    defaultExport: false,
    kind: 'text',
    hasChildren: true,
    enabled: true,
    supportLevel: 'configurable',
    defaultProps: {
      action: 'highlight',
      color: '#87cefa',
    },
    defaultChildren: '高亮文字',
    collections: ['blog'],
    extractSummary: (_props, childrenText) => childrenText || '高亮文字',
    fields: [
      {
        name: 'action',
        label: '强调样式',
        control: 'select',
        options: {
          highlight: '高亮',
          underline: '下划线',
          box: '边框',
          circle: '圆圈',
          'strike-through': '删除线',
          'crossed-off': '交叉线',
          bracket: '括号',
        },
      },
      { name: 'color', label: '颜色', control: 'color', placeholder: '#ffd1dc' },
    ],
  },
  {
    name: 'PreviewLink',
    label: '预览链接',
    category: '文字与链接',
    description: '悬浮展示网页缩略卡片的外部或站内链接',
    source: '@/components/article/PreviewLink',
    defaultExport: true,
    kind: 'text',
    hasChildren: true,
    enabled: true,
    supportLevel: 'configurable',
    defaultProps: {
      href: 'https://',
    },
    defaultChildren: '链接标题',
    collections: ['blog'],
    extractSummary: (props, childrenText) => childrenText || props.href || '预览链接',
    fields: [
      {
        name: 'href',
        label: '链接地址',
        control: 'url',
        required: true,
        placeholder: 'https://… 或 /站内路径',
      },
    ],
  },
  {
    name: 'ExploreCard',
    label: '展开卡片',
    category: '内容容器',
    description: '可折叠探索卡片，用于 Snippet of the Week 或延伸知识阅读',
    source: '@/components/article/ExploreCard',
    defaultExport: true,
    kind: 'flow',
    hasChildren: true,
    enabled: true,
    supportLevel: 'configurable',
    defaultProps: {
      title: 'Snippet of the Week — 探索主题',
    },
    defaultChildren: '在此编写延伸思考、代码或公式...',
    collections: ['blog'],
    extractSummary: (props) => props.title || '展开卡片',
    fields: [{ name: 'title', label: '卡片标题', control: 'text', required: true }],
  },
  {
    name: 'TechSkillsCloud',
    label: '技能云',
    category: '展示组件',
    description: '动态技术栈技能云，按标签和分类展示开发者技能全景',
    source: '@/components/article/TechSkillsCloud',
    defaultExport: true,
    kind: 'flow',
    hasChildren: false,
    enabled: true,
    supportLevel: 'source',
    defaultProps: {
      headingId: 'technical-skills',
    },
    collections: ['blog'],
    extractSummary: (props) => props.headingId || '技能云',
    fields: [{ name: 'headingId', label: '关联标题 ID', control: 'text' }],
  },
  {
    name: 'TechStackTerminal',
    label: '技术栈终端',
    category: '展示组件',
    description: '模拟终端卡片，展示全栈角色画像与技能矩阵',
    source: '@/components/about/TechStackTerminal',
    defaultExport: true,
    kind: 'flow',
    hasChildren: false,
    enabled: true,
    supportLevel: 'source',
    defaultProps: {
      successMessage: '✔ Type-check complete. Profile exported.',
    },
    collections: ['blog'],
    extractSummary: (props) => props.successMessage || '技术栈终端',
    fields: [
      { name: 'profile', label: '技术栈数据', control: 'source' },
      { name: 'successMessage', label: '完成提示', control: 'text' },
    ],
  },
];
