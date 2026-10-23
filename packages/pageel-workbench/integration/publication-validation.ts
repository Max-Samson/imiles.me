export interface PublicationIssue {
  field: string;
  message: string;
}

type PublicationCollection = 'blog' | 'stories';

function isValidDate(value: unknown): value is string | Date {
  return (typeof value === 'string' || value instanceof Date) &&
    Boolean(String(value).trim()) &&
    !Number.isNaN(new Date(value).getTime());
}

/** 属性完整性属于发布门槛；导入阶段允许暂缺，所有问题一次列出。 */
export function validatePublicationFields(fields: Record<string, unknown>, collection: PublicationCollection): PublicationIssue[] {
  const issues: PublicationIssue[] = [];
  for (const [field, label] of [['title', '标题'], ['description', '摘要']]) {
    if (typeof fields[field] !== 'string' || !String(fields[field]).trim()) {
      issues.push({ field, message: `请补充${label}（${field}）` });
    }
  }
  // YAML 日期可能已解析成 Date，表单编辑则返回字符串；拒绝数字，避免 0 被当作合法日期。
  if (!isValidDate(fields.pubDate)) {
    issues.push({ field: 'pubDate', message: '请选择有效的发布日期（pubDate）' });
  }
  if (fields.updatedDate !== undefined && !isValidDate(fields.updatedDate)) {
    issues.push({ field: 'updatedDate', message: '请选择有效的更新日期（updatedDate）' });
  }
  if (!Array.isArray(fields.tags) || fields.tags.some(tag => typeof tag !== 'string')) {
    issues.push({ field: 'tags', message: '请将标签（tags）配置为字符串数组，可留为空数组' });
  }
  if (fields.lang !== undefined && fields.lang !== 'en' && fields.lang !== 'zh') {
    issues.push({ field: 'lang', message: '请选择中文 zh 或英文 en（lang）' });
  }
  if (fields.draft !== undefined && typeof fields.draft !== 'boolean') {
    issues.push({ field: 'draft', message: '草稿状态（draft）须为 true 或 false' });
  }
  if (fields.llms !== undefined && typeof fields.llms !== 'boolean') {
    issues.push({ field: 'llms', message: 'AI 索引（llms）须为 true 或 false' });
  }
  // 仅 Blog schema 含这两个字段；Stories 的未知字段由内容集合 schema 自行处理。
  if (collection === 'blog') {
    for (const [field, label] of [['heroImage', '封面路径'], ['shareText', '分享文案']]) {
      if (fields[field] !== undefined && typeof fields[field] !== 'string') {
        issues.push({ field, message: `${label}（${field}）须为字符串` });
      }
    }
  }
  // 仅返回属性提示；这不是发布授权，也不涵盖 MDX 构建、资源存在性与部署结果。
  return issues;
}
