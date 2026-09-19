/** 接受裸标签或完整的强/弱 ETag，拒绝非法标头字符。 */
export function formatEtag(value: string): string {
  const formatted = value.startsWith('"') || value.startsWith('W/"') ? value : `"${value}"`;
  if (!/^(W\/)?"[\x21\x23-\x7e\x80-\xff]*"$/.test(formatted)) {
    throw new TypeError('Invalid ETag');
  }
  return formatted;
}

/** If-None-Match 使用弱比较；逗号可出现在双引号内。 */
export function matchesEtag(header: string, etag: string): boolean {
  if (header.trim() === '*') return true;
  if (
    !/^\s*(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*"(?:\s*,\s*(?:W\/)?"[\x21\x23-\x7e\x80-\xff]*")*\s*$/.test(
      header,
    )
  ) {
    return false;
  }
  const tags = header.match(/(?:W\/)?"[^"\r\n]*"/g) ?? [];
  const target = formatEtag(etag).replace(/^W\//, '');
  return tags.some((tag) => tag.replace(/^W\//, '') === target);
}
