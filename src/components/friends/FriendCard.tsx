'use client';

import { Icon } from '@iconify/react';
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
  name?: string;
  url?: string;
  description?: string;
  avatarUrl?: string | null;
  screenshotUrl?: string | null;
  size?: 'default' | 'large';
  lang?: Locale;
  index?: number;
  interactive?: boolean;
  className?: string;
}

const PALETTE = [
  'from-amber-500/8 via-transparent to-transparent dark:from-[#2a2418]/60 dark:via-[#1e1e21] dark:to-[#121214]',
  'from-sky-500/8 via-transparent to-transparent dark:from-[#152328]/60 dark:via-[#1e1e21] dark:to-[#121214]',
  'from-emerald-500/8 via-transparent to-transparent dark:from-[#1a201c]/60 dark:via-[#1e1e21] dark:to-[#121214]',
  'from-violet-500/8 via-transparent to-transparent dark:from-[#221c28]/60 dark:via-[#1e1e21] dark:to-[#121214]',
  'from-rose-500/8 via-transparent to-transparent dark:from-[#241c1c]/60 dark:via-[#1e1e21] dark:to-[#121214]',
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
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgErr, setImgErr] = useState(false);
  const [favErr, setFavErr] = useState(false);
  const [avatarErr, setAvatarErr] = useState(false);

  const isLarge = size === 'large';

  const targetUrl = item?.url || url || '';
  const targetName = name || item?.name || '';
  const targetDesc = description ?? item?.description ?? '';
  const targetAvatar = avatarUrl ?? null;
  const targetScreenshot =
    screenshotUrl !== undefined ? screenshotUrl : (item?.screenshotUrl ?? null);

  const hostname = useMemo(() => {
    if (!targetUrl) return '';
    try {
      return new URL(
        targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
      ).hostname.replace(/^www\./, '');
    } catch {
      return (
        targetUrl
          .replace(/^https?:\/\//, '')
          .replace(/^www\./, '')
          .split('/')[0] || targetUrl
      );
    }
  }, [targetUrl]);

  const href = useMemo(
    () => (targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`),
    [targetUrl],
  );

  const displayName = targetName.trim() || hostname || 'Friend';
  const initial = displayName.charAt(0).toUpperCase();

  const grad = useMemo(() => {
    let h = 0;
    const s = hostname || displayName;
    for (let i = 0; i < s.length; i++) {
      h = (h << 5) - h + s.charCodeAt(i);
      h |= 0;
    }
    return PALETTE[Math.abs(h) % PALETTE.length];
  }, [hostname, displayName]);

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
  const canClick = interactive && Boolean(href);

  // ─── 头像渲染 ───
  const avatar =
    targetAvatar && !avatarErr ? (
      <img
        src={targetAvatar}
        alt={displayName}
        className={cn(
          'rounded-full object-cover ring-2 ring-border/60 dark:ring-white/8',
          isLarge ? 'size-14' : 'size-11',
        )}
        onError={() => setAvatarErr(true)}
      />
    ) : !favErr && hostname ? (
      <div
        className={cn(
          'rounded-full bg-muted/60 dark:bg-white/5 border border-border/60 dark:border-white/8 flex items-center justify-center',
          isLarge ? 'size-14 p-2.5' : 'size-11 p-2',
        )}
      >
        <img
          src={faviconUrl}
          alt=""
          className={cn('rounded-full object-contain', isLarge ? 'size-8' : 'size-6')}
          onError={() => setFavErr(true)}
        />
      </div>
    ) : (
      <div
        className={cn(
          'rounded-full bg-gradient-to-br from-amber-500/15 to-sky-500/10 dark:from-[#2a2418] dark:to-[#17171a] border border-amber-500/20 dark:border-white/8 flex items-center justify-center',
          isLarge ? 'size-14' : 'size-11',
        )}
      >
        <span
          className={cn(
            'font-bold font-mono text-amber-600 dark:text-[#d4a958]',
            isLarge ? 'text-xl' : 'text-base',
          )}
        >
          {initial}
        </span>
      </div>
    );

  // ─── 卡片内容 ───
  const content = (
    <>
      {/* 头部：头像 + 名称 + 跳转 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="shrink-0">{avatar}</div>
          <div className="min-w-0 flex-1">
            <h4
              className={cn(
                'font-bold text-foreground tracking-tight truncate',
                isLarge ? 'text-base sm:text-lg' : 'text-sm',
              )}
            >
              {displayName}
            </h4>
            <p
              className={cn(
                'text-muted-foreground/70 font-mono truncate mt-0.5',
                isLarge ? 'text-xs' : 'text-[11px]',
              )}
            >
              {hostname}
            </p>
          </div>
        </div>

        {canClick ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'shrink-0 rounded-lg text-muted-foreground/50 hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/5 transition-all',
              isLarge ? 'p-2' : 'p-1.5',
            )}
            title={`Visit ${hostname}`}
            aria-label={`Visit ${displayName}`}
          >
            <Icon
              icon="ph:arrow-up-right-bold"
              width={isLarge ? 16 : 14}
              height={isLarge ? 16 : 14}
            />
          </a>
        ) : (
          <span
            className={cn('shrink-0 text-muted-foreground/20', isLarge ? 'p-2' : 'p-1.5')}
            aria-hidden
          >
            <Icon
              icon="ph:arrow-up-right-bold"
              width={isLarge ? 16 : 14}
              height={isLarge ? 16 : 14}
            />
          </span>
        )}
      </div>

      {/* 描述 */}
      <p
        className={cn(
          'text-foreground/80 leading-relaxed break-words',
          isLarge ? 'text-sm my-3.5 line-clamp-4' : 'text-xs my-3 line-clamp-3',
        )}
        title={targetDesc}
      >
        {targetDesc || t('FriendsModalPreviewDescPlaceholder')}
      </p>

      {/* 截图 / 占位 */}
      <div className="relative w-full rounded-xl overflow-hidden border border-border/60 dark:border-white/8 bg-muted/30 dark:bg-[#0d0d10] transition-colors group-hover:border-amber-500/25 dark:group-hover:border-white/15 mt-auto">
        {/* 浏览器栏 */}
        <div
          className={cn(
            'flex items-center justify-between border-b border-border/40 dark:border-white/5 bg-muted/50 dark:bg-[#141417] text-muted-foreground/60 select-none',
            isLarge ? 'px-3.5 py-1.5' : 'px-3 py-1',
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-red-400/60" />
            <span className="size-2 rounded-full bg-amber-400/60" />
            <span className="size-2 rounded-full bg-emerald-400/60" />
          </div>
          <span className="font-mono text-[10px] truncate max-w-[200px]">{hostname}</span>
          <div className="w-6" />
        </div>

        {/* 截图主体 */}
        <div
          className={cn(
            'relative w-full overflow-hidden bg-background/40 dark:bg-[#0a0a0c]',
            isLarge ? 'h-60 sm:h-72 md:h-80' : 'h-40 sm:h-48',
          )}
        >
          {targetScreenshot && !imgErr ? (
            <>
              {!imgLoaded && (
                <div className="absolute inset-0 bg-muted dark:bg-[#16161a] animate-pulse" />
              )}
              <img
                src={targetScreenshot}
                alt={`${displayName} homepage`}
                loading="lazy"
                onLoad={() => setImgLoaded(true)}
                onError={() => setImgErr(true)}
                className={cn(
                  'w-full h-full object-cover object-top transition-transform duration-500',
                  canClick && 'group-hover:scale-[1.02]',
                  imgLoaded ? 'opacity-100' : 'opacity-0',
                )}
              />
            </>
          ) : (
            <div
              className={cn(
                'w-full h-full flex flex-col items-center justify-center p-6 relative bg-gradient-to-br select-none',
                grad,
              )}
            >
              <div className="absolute inset-0 bg-[radial-gradient(#d4a958_0.5px,transparent_0.5px)] [background-size:12px_12px] opacity-[0.08]" />
              <div className="relative z-10 flex flex-col items-center text-center space-y-2">
                <span
                  className={cn(
                    'font-black font-mono tracking-tight text-foreground/15 dark:text-white/12',
                    isLarge ? 'text-4xl sm:text-5xl' : 'text-3xl',
                  )}
                >
                  {displayName}
                </span>
                <span
                  className={cn(
                    'font-mono text-muted-foreground/50 tracking-wider',
                    isLarge ? 'text-xs' : 'text-[10px]',
                  )}
                >
                  {targetUrl}
                </span>
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full bg-foreground/3 dark:bg-white/5 text-muted-foreground/60 border border-border/30 dark:border-white/5',
                    isLarge ? 'px-3.5 py-1.5 text-xs' : 'px-3 py-1 text-[10px]',
                  )}
                >
                  <Icon
                    icon="ph:globe-duotone"
                    width={isLarge ? 13 : 11}
                    height={isLarge ? 13 : 11}
                  />
                  <span>Explore</span>
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const cls = cn(
    'group relative flex flex-col rounded-2xl bg-card dark:bg-[#121214] border border-border/80 dark:border-white/8 transition-all duration-300 shadow-sm overflow-hidden',
    isLarge ? 'p-6 sm:p-7 shadow-md' : 'p-4 sm:p-5',
    canClick &&
      'hover:border-amber-500/30 dark:hover:border-white/15 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/3 dark:hover:shadow-[0_12px_32px_rgba(0,0,0,0.4)] cursor-pointer',
    className,
  );

  const mp = {
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: index !== undefined ? Math.min(index * 0.035, 0.25) : 0 },
    className: cls,
  };

  if (canClick) {
    return (
      <motion.a href={href} target="_blank" rel="noopener noreferrer" {...mp}>
        {content}
      </motion.a>
    );
  }
  return <motion.div {...mp}>{content}</motion.div>;
}
