import { useDeferredValue, useMemo, useState } from 'react';
import { getSourceImages, isSafeImagePreviewUrl } from '../../../../src/lib/content-images';

function PreviewImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!isSafeImagePreviewUrl(src)) return <p role="status">图片地址不支持预览</p>;
  return failed ? (
    <p role="status" className="p-3 text-xs text-amber-700">
      图片暂不可用，请检查地址、上传状态或登录状态。
    </p>
  ) : (
    <img
      src={src}
      alt={alt || '正文图片预览'}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="max-h-64 w-full object-contain"
    />
  );
}

/** 源码仍然是纯文本；预览是派生视图，不回写正文，也不提供第二套插图入口。 */
export function SourceImagePreview({
  source,
  mdx,
  resolveUrl,
}: {
  source: string;
  mdx: boolean;
  resolveUrl: (url: string) => string;
}) {
  const deferred = useDeferredValue(source);
  const { images, issues } = useMemo(() => getSourceImages(deferred, mdx), [deferred, mdx]);
  return (
    <section
      aria-label="源码图片预览"
      className="mt-4 rounded-xl border border-notion-border bg-notion-sidebar/20 p-4"
    >
      <h3 className="mb-2 text-sm font-semibold text-notion-text">源码图片预览</h3>
      <p className="mb-3 text-xs text-notion-muted">
        随源码更新；插入新图片请切换到“编辑”模式。这里只预览静态图片，不执行 MDX 组件。
      </p>
      {!images.length && <p className="text-xs text-notion-muted">当前正文没有可预览的图片。</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {images.map((image) => {
          const src = resolveUrl(image.url);
          return (
            <figure
              key={image.url}
              className="overflow-hidden rounded-lg border border-notion-border bg-notion-bg p-2"
            >
              <PreviewImage key={src} src={src} alt={image.alt} />
              <figcaption className="mt-2 break-all text-xs text-notion-muted">
                {image.alt || image.url}
              </figcaption>
            </figure>
          );
        })}
      </div>
      {issues.length > 0 && (
        <p role="status" className="mt-3 text-xs text-amber-700">
          部分图片引用尚未完整：{[...new Set(issues)].join('；')}
        </p>
      )}
    </section>
  );
}
