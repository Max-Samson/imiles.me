/**
 * 第三方图片版权登记表。
 *
 * 项目规范(见 AGENTS.md):所有第三方图片必须在此登记版权,键为 public/ 下的
 * 图片路径,值为摄影者/作者姓名与来源链接。原创图片无需登记。
 *
 * 示例:
 * '/images/example.webp': {
 *   photographer: '作者名',
 *   url: 'https://unsplash.com/@author',
 * }
 */
interface ImageCredit {
  photographer: string;
  url: string;
}

export const imageCredits: Record<string, ImageCredit> = {};
