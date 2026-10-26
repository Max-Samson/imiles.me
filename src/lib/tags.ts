/**
 * 标签规范化与格式化工具函数
 */

/**
 * 将各种来源的标签输入（字符串、数组、混用中英文标点）清洗为规范的字符串数组：
 * 1. 支持中英文逗号（, ，）、顿号（、）、分号（; ；）、换行以及以 # 分隔的格式
 * 2. 自动剔除每个标签开头的 # 或 ＃
 * 3. 去除首尾空白，过滤空值
 * 4. 忽略大小写去重（保留首次出现的字面大小写）
 */
export function normalizeTags(input: unknown): string[] {
  if (!input) return [];

  const rawList: string[] = [];
  if (Array.isArray(input)) {
    for (const item of input) {
      if (typeof item === 'string') {
        // 切分常见分隔符：中英文逗号、顿号、分号、换行，或者紧随 #/＃ 前的空白
        rawList.push(...item.split(/(?:[,，、;；\n\r]+|\s+(?=[#＃]))/));
      } else if (item != null) {
        rawList.push(String(item));
      }
    }
  } else if (typeof input === 'string') {
    rawList.push(...input.split(/(?:[,，、;；\n\r]+|\s+(?=[#＃]))/));
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    const clean = item.replace(/^[#＃\s]+/, '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      result.push(clean);
    }
  }

  return result;
}

/**
 * 统一保证标签带有单个 # 前缀显示，例如 #内容
 */
export function formatTagDisplay(tag: string): string {
  const clean = tag.replace(/^[#＃\s]+/, '').trim();
  return `#${clean}`;
}
