export const fieldLabels: Record<string, string> = {
  title: '标题', description: '摘要', pubDate: '发布日期', updatedDate: '更新日期',
  tags: '标签', draft: '草稿', heroImage: '封面', shareText: '分享文案', lang: '语言', llms: 'AI 索引',
};
export const fieldLabel = (key: string) => fieldLabels[key] ?? key;
