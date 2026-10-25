/** 请求只能由发起它的文稿实例消费，取消或后续请求会立即使旧结果失效。 */
export function createImageRequestGate() {
  let generation = 0;
  return {
    begin(documentKey: string) {
      return { generation: ++generation, documentKey };
    },
    cancel() {
      generation++;
    },
    isCurrent(ticket: { generation: number; documentKey: string }, documentKey: string) {
      return ticket.generation === generation && ticket.documentKey === documentKey;
    },
  };
}
export function validateArticleImageFile(file: Pick<File, 'size' | 'type'>) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('仅支持 PNG、JPEG、WebP 图片');
  if (!file.size || file.size > 2 * 1024 * 1024) throw new Error('图片不能为空，且不能超过 2 MiB');
}
export function isInsertableImageUrl(url: string) {
  return (
    url.startsWith('/images/') &&
    !url.includes('..') &&
    !/[?#\\\s]/.test(url) &&
    ![...url].some((char) => char.charCodeAt(0) < 32)
  );
}
