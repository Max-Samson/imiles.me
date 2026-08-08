import type { DemoConfig, ProjectFeature, ProjectTech } from './projects';

export type ResearchCategory = 'paper';

/**
 * 研究条目数据结构(驱动 /research 页面与 sitemap)。
 *
 * 字段说明:
 * - slug: 唯一标识,同时作为详情页 URL(/research/<slug>)
 * - title / tagline / description: 标题、一句话简介、详细介绍
 * - category: 条目类型(目前仅 'paper')
 * - year / venue: 发表年份、发表场合(期刊/会议/论文等)
 * - tags: 标签数组
 * - githubUrl / paperUrl: 代码仓库与论文链接
 * - tech: 技术栈名称数组
 * - hasDetailPage: 是否生成独立详情页
 * - detailTech / features / demo: 详情页专用(技术明细、功能列表、演示配置),与 projects.ts 共用类型
 * - llms: 是否纳入 llms.txt 索引
 */
export interface ResearchItem {
  slug: string;
  title: string;
  tagline: string;
  description: string;
  category: ResearchCategory;
  year: number;
  venue?: string;
  tags: string[];
  githubUrl: string;
  paperUrl?: string;
  tech: string[];
  hasDetailPage: boolean;
  detailTech?: ProjectTech[];
  features?: ProjectFeature[];
  demo?: DemoConfig;
  llms?: boolean;
}

/**
 * 研究条目数据(当前为空,待补充自己的研究)。
 *
 * 添加方法:按 ResearchItem 结构在数组中新增对象即可,页面按数组顺序渲染,
 * /research/<slug> 详情页与 sitemap 会自动生成。
 *
 * 示例(字段按需填写):
 * {
 *   slug: 'my-research',
 *   title: '研究标题',
 *   tagline: '一句话简介',
 *   description: '详细介绍',
 *   category: 'paper',
 *   year: 2026,
 *   tags: ['ai', 'ml'],
 *   githubUrl: 'https://github.com/你的仓库',
 *   tech: ['Python'],
 *   hasDetailPage: false,
 * }
 */
export const research: ResearchItem[] = [];

/** 按 slug 查找研究条目(供详情页使用) */
export function getResearchItem(slug: string): ResearchItem | undefined {
  return research.find((r) => r.slug === slug);
}
