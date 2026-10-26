export const fieldLabels: Record<string, string> = {
  title: '标题', description: '摘要', pubDate: '发布日期', updatedDate: '更新日期',
  tags: '标签', heroImage: '封面', shareText: '分享文案', lang: '语言', llms: 'AI 索引',
  slug: '地址标识', url: '访问路径',
};
export const fieldLabel = (key: string) => fieldLabels[key] ?? key;
