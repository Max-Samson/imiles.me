export interface ExtractedHeading {
  depth: number;
  slug: string;
  text: string;
}

/** 从已渲染的 HTML 中提取 h2/h3 标题供目录 (TOC) 展示 */
export function extractHeadingsFromHtml(html: string): ExtractedHeading[] {
  const matches = [...html.matchAll(/<h([23])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h[23]>/g)];
  return matches.map((m) => ({
    depth: Number(m[1]),
    slug: m[2],
    text: m[3].replace(/<[^>]+>/g, ''),
  }));
}
