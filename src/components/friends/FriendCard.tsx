'use client';

import { ExternalLink, Globe } from 'lucide-react';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

export interface FriendLinkItem {
  id: string;
  url: string;
  name: string | null;
  description: string;
  screenshotUrl: string | null;
}

export interface FriendCardProps {
  item?: FriendLinkItem;
  name?: string; // 博客名称
  url?: string; // 博客地址
  description?: string; // 个人 / 博客介绍
  avatarUrl?: string | null; // 用户头像
  screenshotUrl?: string | null; // 站点首页图片
  size?: 'default' | 'large'; // 显示尺寸级别（large 用于英雄展位/名片放大）
  lang?: Locale;
  index?: number;
  interactive?: boolean; // 是否可点击跳转访问（默认 true）
  className?: string;
}

// 算法几何渐变背景调色板
const MESH_GRADIENT_PALETTES = [
  'from-amber-500/10 via-amber-500/5 to-transparent dark:from-[#1e1e21] dark:via-[#2a2418] dark:to-[#121214]',
  'from-sky-500/10 via-sky-500/5 to-transparent dark:from-[#121214] dark:via-[#152328] dark:to-[#1e1e21]',
  'from-emerald-500/10 via-emerald-500/5 to-transparent dark:from-[#1a201c] dark:via-[#1e1e21] dark:to-[#141b17]',
  'from-purple-500/10 via-purple-500/5 to-transparent dark:from-[#221c24] dark:via-[#1e1e21] dark:to-[#1c1822]',
];

export default function FriendCard({
  item,
  name,
  url,
  description,
  avatarUrl,
  screenshotUrl,
  size = 'default',
  lang,
  index,
  interactive = true,
  className,
}: FriendCardProps) {
  const { t } = useTranslations(lang || 'en');
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

  const isLarge = size === 'large';

  // 统一字段提取
  const targetUrl = item?.url || url || '';
  const targetName = name || item?.name || '';
  const targetDescription = description ?? item?.description ?? '';
  const targetAvatar = avatarUrl ?? null;
  const targetScreenshot =
    screenshotUrl !== undefined ? screenshotUrl : (item?.screenshotUrl ?? null);

  // 提取主机名（例如: "imiles.me"）
  const hostname = useMemo(() => {
    if (!targetUrl) return '';
    try {
      const parsed = new URL(
        targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
          ? targetUrl
          : `https://${targetUrl}`,
      );
      return parsed.hostname.replace(/^www\./, '');
    } catch {
      return (
        targetUrl
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0] || targetUrl
      );
    }
  }, [targetUrl]);

  // 格式化跳转目标链接
  const formattedUrl = useMemo(() => {
    if (!targetUrl) return '';
    return targetUrl.startsWith('http://') || targetUrl.startsWith('https://')
      ? targetUrl
      : `https://${targetUrl}`;
  }, [targetUrl]);

  // 博客名称与首字母展示
  const displayName = targetName.trim() || hostname || 'Friend';
  const initial = displayName.charAt(0).toUpperCase();

  // 算法网格渐变色彩
  const gradientClass = useMemo(() => {
    let hash = 0;
    const seed = hostname || displayName;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % MESH_GRADIENT_PALETTES.length;
    return MESH_GRADIENT_PALETTES[idx];
  }, [hostname, displayName]);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  const isInteractive = interactive && Boolean(formattedUrl);

  // 卡片内部核心结构
  const innerContent = (
    <>
      {/* 1. 顶部 Header：用户头像 + 博客名称 + 博客地址 + 右上角跳转图标 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* 用户圆形头像 */}
          <div className="relative flex-shrink-0">
            {targetAvatar && !avatarError ? (
              <img
                key={targetAvatar}
                src={targetAvatar}
                alt={displayName}
                className={cn(
                  'rounded-full object-cover ring-2 ring-border/80 dark:ring-white/10 shadow-sm',
                  isLarge ? 'w-13 h-13 sm:w-14 sm:h-14' : 'w-11 h-11 sm:w-12 sm:h-12',
                )}
                onError={() => setAvatarError(true)}
              />
            ) : !faviconError && hostname ? (
              <div
                className={cn(
                  'rounded-full bg-muted/70 dark:bg-white/5 border border-border dark:border-white/10 flex items-center justify-center p-2 shadow-sm',
                  isLarge ? 'w-13 h-13 sm:w-14 sm:h-14' : 'w-11 h-11 sm:w-12 sm:h-12',
                )}
              >
                <img
                  key={faviconUrl}
                  src={faviconUrl}
                  alt=""
                  className={cn(
                    'rounded-full object-contain',
                    isLarge ? 'w-7 h-7 sm:w-8 sm:h-8' : 'w-6 h-6',
                  )}
                  onError={() => setFaviconError(true)}
                />
              </div>
            ) : (
              <div
                className={cn(
                  'rounded-full bg-gradient-to-br from-amber-500/20 via-sky-500/10 to-transparent dark:from-[#2a2418] dark:to-[#17171a] border border-amber-500/30 dark:border-white/10 flex items-center justify-center shadow-sm',
                  isLarge ? 'w-13 h-13 sm:w-14 sm:h-14' : 'w-11 h-11 sm:w-12 sm:h-12',
                )}
              >
                <span
                  className={cn(
                    'font-bold font-mono text-amber-600 dark:text-[#d4a958]',
                    isLarge ? 'text-lg sm:text-xl' : 'text-base',
                  )}
                >
                  {initial}
                </span>
              </div>
            )}
          </div>

          {/* 博客名称与博客地址 */}
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                'font-bold text-foreground tracking-tight truncate',
                isLarge ? 'text-base sm:text-lg md:text-xl' : 'text-sm sm:text-base',
              )}
            >
              {displayName}
            </h4>
            <p
              className={cn(
                'text-muted-foreground font-mono truncate mt-0.5',
                isLarge ? 'text-xs sm:text-sm' : 'text-xs',
              )}
            >
              @{hostname}
            </p>
          </div>
        </div>

        {/* 右上角显示一个图标，点击后可以跳转访问对应的博客页 */}
        {isInteractive ? (
          <a
            href={formattedUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'flex-shrink-0 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10 border border-transparent hover:border-border dark:hover:border-white/10 transition-all duration-200',
              isLarge ? 'p-2.5' : 'p-2',
            )}
            title={`Visit ${hostname}`}
            aria-label={`Visit ${displayName}`}
          >
            <ExternalLink size={isLarge ? 18 : 16} />
          </a>
        ) : (
          <span
            className={cn(
              'flex-shrink-0 rounded-xl text-muted-foreground/40 border border-transparent',
              isLarge ? 'p-2.5' : 'p-2',
            )}
            aria-hidden="true"
          >
            <ExternalLink size={isLarge ? 18 : 16} />
          </span>
        )}
      </div>

      {/* 2. 博客或个人介绍 */}
      <p
        className={cn(
          'text-foreground/85 leading-relaxed font-normal break-words',
          isLarge
            ? 'text-sm sm:text-[14.5px] my-3.5 line-clamp-4'
            : 'text-xs sm:text-[13.5px] my-3 line-clamp-3',
        )}
        title={targetDescription}
      >
        {targetDescription || t('FriendsModalPreviewDescPlaceholder')}
      </p>

      {/* 3. 站点首页图片展示（带浏览器窗口外框） */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border/80 dark:border-white/10 bg-muted/40 dark:bg-[#0d0d10] transition-all group-hover:border-amber-500/30 dark:group-hover:border-white/20 shadow-inner mt-1">
        {/* 浏览器窗口顶栏装饰 */}
        <div
          className={cn(
            'flex items-center justify-between border-b border-border/50 dark:border-white/5 bg-muted/70 dark:bg-[#141417] text-muted-foreground select-none',
            isLarge ? 'px-3.5 py-2 text-xs' : 'px-3 py-1.5 text-[10px]',
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500/70" />
            <span className="w-2 h-2 rounded-full bg-amber-500/70" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
          </div>
          <span className="font-mono text-muted-foreground/60 truncate max-w-[220px]">
            {hostname}
          </span>
          <div className="w-8" />
        </div>

        {/* 站点首页图片主体展示 */}
        <div
          className={cn(
            'relative w-full overflow-hidden bg-background/50 dark:bg-[#0a0a0c]',
            isLarge ? 'h-64 sm:h-72 md:h-80 lg:h-96' : 'h-44 sm:h-52',
          )}
        >
          {targetScreenshot && !imageError ? (
            <>
              {!imageLoaded && (
                <div className="absolute inset-0 bg-muted dark:bg-[#16161a] animate-pulse" />
              )}
              <img
                key={targetScreenshot}
                src={targetScreenshot}
                alt={`${displayName} homepage`}
                loading="lazy"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
                className={cn(
                  'w-full h-full object-cover object-top transition-transform duration-500',
                  isInteractive && 'group-hover:scale-[1.02]',
                  imageLoaded ? 'opacity-100' : 'opacity-0',
                )}
              />
            </>
          ) : (
            /* 极简深色科技感 Linear 风格首页兜底预览 */
            <div
              className={cn(
                'w-full h-full flex flex-col items-center justify-center p-6 relative bg-gradient-to-br select-none',
                gradientClass,
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#d4a958_1px,transparent_1px)] [background-size:16px_16px] opacity-15 dark:opacity-20" />
              <div className="relative z-10 flex flex-col items-center text-center max-w-sm space-y-2.5">
                <span
                  className={cn(
                    'font-black font-mono tracking-tight text-foreground/25 dark:text-white/20',
                    isLarge ? 'text-4xl sm:text-5xl md:text-6xl' : 'text-3xl sm:text-4xl',
                  )}
                >
                  {displayName}
                </span>
                <span
                  className={cn(
                    'font-mono text-muted-foreground/80 tracking-wider',
                    isLarge ? 'text-xs sm:text-sm' : 'text-[11px]',
                  )}
                >
                  {targetUrl}
                </span>
                <div className="pt-2">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full font-medium bg-foreground/5 dark:bg-white/10 text-muted-foreground border border-border/40 dark:border-white/10',
                      isLarge ? 'px-3.5 py-1.5 text-xs' : 'px-3 py-1 text-[10px]',
                    )}
                  >
                    <Globe size={isLarge ? 13 : 11} />
                    <span>Explore Website</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const containerClasses = cn(
    'group relative flex flex-col rounded-2xl bg-card dark:bg-[#121214] border border-border dark:border-white/10 transition-all duration-300 shadow-sm overflow-hidden',
    isLarge ? 'p-6 sm:p-7 md:p-8 shadow-md' : 'p-5 sm:p-6',
    isInteractive &&
      'hover:border-amber-500/40 dark:hover:border-white/20 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-[0_16px_40px_rgba(0,0,0,0.5)] cursor-pointer',
    className,
  );

  const motionProps = {
    initial: { opacity: 0, y: 15 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.35,
      delay: index !== undefined ? Math.min(index * 0.04, 0.3) : 0,
    },
    className: containerClasses,
  };

  if (isInteractive) {
    return (
      <motion.a href={formattedUrl} target="_blank" rel="noopener noreferrer" {...motionProps}>
        {innerContent}
      </motion.a>
    );
  }

  return <motion.div {...motionProps}>{innerContent}</motion.div>;
}
