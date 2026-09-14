'use client';

import { Check, Copy, RotateCcw } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ComponentPreviewProps {
  /** 预览组件节点 */
  children: React.ReactNode;
  /** 对应的示例代码文本 (JSX/TSX) */
  code: string;
  /** 预览舞台最小高度，默认 420px (参照 Magic UI 规格) */
  minHeight?: string;
  /** 预览画布内边距，默认 'p-6 sm:p-10'，宽幅组件可传入 'px-2 sm:px-4 py-8' */
  contentPadding?: string;
  /** 自定义外层类名 */
  className?: string;
  /** 预览画布背景类型 */
  canvasBackground?: 'dots' | 'grid' | 'aurora' | 'blank';
  /** 是否允许重新触发刷新 (显示重放按钮) */
  allowReplay?: boolean;
  /** 居中对齐方式 */
  align?: 'center' | 'start' | 'end';
}

/**
 * ComponentPreview — 参照 Magic UI 官方文档（Image #1）打造的标准组件视窗
 *
 * 特性：
 * 1. 顶部左侧：极简文字风格 [Preview] 与 [Code] 标签切换
 * 2. 边框卡片右上角：↻ 重放动画与 📋 一键复制代码
 * 3. 居中自适应的大留白预览画布与浅色/深色自适应点阵底纹
 * 4. Code 选项卡代码视图
 */
export function ComponentPreview({
  children,
  code,
  minHeight = 'min-h-[420px]',
  contentPadding,
  className,
  canvasBackground = 'dots',
  allowReplay = true,
  align = 'center',
}: ComponentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [remountKey, setRemountKey] = useState(0);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReplay = () => {
    setRemountKey((k) => k + 1);
  };

  return (
    <div className={cn('relative my-6 flex flex-col gap-3', className)}>
      {/* 1. 选项卡标题栏 (参照 Image #1 极简文字风格 Preview | Code) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5 text-sm font-medium select-none">
          <button
            type="button"
            onClick={() => setActiveTab('preview')}
            className={cn(
              'transition-colors cursor-pointer pb-1',
              activeTab === 'preview'
                ? 'text-foreground font-semibold border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={cn(
              'transition-colors cursor-pointer pb-1',
              activeTab === 'code'
                ? 'text-foreground font-semibold border-b-2 border-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Code
          </button>
        </div>

        {/* 右侧小工具 */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            title="复制代码"
            aria-label="Copy code"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all cursor-pointer shadow-xs active:scale-95"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-emerald-400" />
                <span className="text-emerald-400 font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. 边框卡片预览视窗 (参照 Image #1 Magic UI 结构) */}
      <div className="relative rounded-2xl border border-border/70 bg-card/40 backdrop-blur-xl shadow-xl overflow-hidden isolate">
        {/* 卡片右上角浮动动作区 (Replay ↻) */}
        {allowReplay && activeTab === 'preview' && (
          <div className="absolute top-3.5 right-3.5 z-30 flex items-center gap-2">
            <button
              type="button"
              onClick={handleReplay}
              title="重新播放组件动效"
              aria-label="Replay animation"
              className="flex size-8 items-center justify-center rounded-lg border border-border/60 bg-background/70 backdrop-blur-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all cursor-pointer shadow-xs active:scale-90"
            >
              <RotateCcw className="size-4" />
            </button>
          </div>
        )}

        {/* 主视窗区 (Tab 容器) */}
        <div className="relative w-full">
          {activeTab === 'preview' ? (
            <div
              key={remountKey}
              className={cn(
                'relative flex w-full overflow-hidden transition-all',
                minHeight,
                contentPadding ?? 'p-6 sm:p-10',
                align === 'center' && 'items-center justify-center',
                align === 'start' && 'items-start justify-center',
                align === 'end' && 'items-end justify-center',
                // Magic UI 经典点阵/几何背景 (明暗模式自适应浅色与深色)
                canvasBackground === 'dots' &&
                  'bg-muted/20 dark:bg-neutral-950/40 [background-image:radial-gradient(rgba(0,0,0,0.12)_1px,transparent_1px)] dark:[background-image:radial-gradient(rgba(255,255,255,0.15)_1px,transparent_1px)] bg-[size:18px_18px]',
                canvasBackground === 'grid' &&
                  'bg-muted/20 dark:bg-neutral-950/40 [background-image:linear-gradient(to_right,rgba(0,0,0,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.06)_1px,transparent_1px)] dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:24px_24px]',
                canvasBackground === 'aurora' &&
                  'bg-muted/30 dark:bg-neutral-950 [background-image:radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.25),transparent)]',
                canvasBackground === 'blank' && 'bg-background',
              )}
            >
              {/* 柔和环境光斑 */}
              <div className="pointer-events-none absolute -top-12 left-1/4 size-72 rounded-full bg-sky-500/10 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 right-1/4 size-72 rounded-full bg-purple-500/10 blur-3xl" />

              <div className="relative z-10 flex items-center justify-center w-full">
                {children}
              </div>
            </div>
          ) : (
            <div className="relative w-full bg-neutral-950 p-6 text-white overflow-x-auto min-h-[300px]">
              <pre className="font-mono text-xs text-sky-300/90 leading-relaxed">
                <code>{code}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
