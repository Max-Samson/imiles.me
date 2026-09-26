'use client';

import { Compass, RefreshCw, Search, Sparkles, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import ExchangeGuideCard from './ExchangeGuideCard';
import FriendApplyModal from './FriendApplyModal';
import FriendCard, { type FriendLinkItem } from './FriendCard';
import FriendsHero from './FriendsHero';

interface FriendsContainerProps {
  lang: Locale;
  turnstileSiteKey: string;
}

export default function FriendsContainer({ lang, turnstileSiteKey }: FriendsContainerProps) {
  const { t } = useTranslations(lang);
  const [items, setItems] = useState<FriendLinkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  // 加载已审核发布的友链列表
  const fetchFriendLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const allItems: FriendLinkItem[] = [];
      let page = 1;
      let hasNextPage = true;
      while (hasNextPage) {
        const res = await fetch(`/api/v1/friend-links?page=${page}&pageSize=100`);
        const body = (await res.json()) as {
          success?: boolean;
          data?: { items?: FriendLinkItem[]; hasNextPage?: boolean };
        };
        if (!res.ok || !body.success || !body.data?.items) {
          throw new Error('Failed to load friend links');
        }
        allItems.push(...body.data.items);
        hasNextPage = body.data.hasNextPage === true;
        page++;
      }
      setItems(allItems);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriendLinks();
  }, [fetchFriendLinks]);

  // 客户端关键词检索；公开接口只返回已审核的友链。
  const processedItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.url, item.description].some((value) => value?.toLowerCase().includes(q)),
    );
  }, [items, searchQuery]);

  const scrollToGuide = () => {
    const el = document.getElementById('exchange-guide');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* 头部 Hero 区域 */}
      <FriendsHero
        lang={lang}
        onApplyClick={() => setModalOpen(true)}
        onGuideClick={scrollToGuide}
      />

      {/* 友链互换约定与本站信息卡片 */}
      <ExchangeGuideCard lang={lang} />

      {/* 友链列表区域头部与搜索栏 */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border dark:border-white/5 pb-4">
        {/* 左侧：标题与数量 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Compass size={20} className="text-amber-600 dark:text-[#d4a958]" />
            <h2 className="text-lg sm:text-xl font-bold text-foreground">
              {t('FriendsSectionTitle')}
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-muted dark:bg-white/5 border border-border dark:border-white/10 text-sky-600 dark:text-[#83a9b9]">
              {processedItems.length}
            </span>
          </div>
        </div>

        {/* 右侧：实时搜索过滤框 */}
        <div className="relative w-full md:w-72">
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('FriendsSearchPlaceholder')}
            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-card border border-border dark:bg-[#1e1e21] dark:border-white/10 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-amber-500 dark:focus:border-[#d4a958] transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* 友链卡片网格内容区 */}
      {loading ? (
        /* 高保真骨架屏 (带微波动画) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-card border border-border dark:bg-[#1e1e21] dark:border-white/5 h-64 overflow-hidden p-4 flex flex-col justify-between shadow-sm"
            >
              <div className="w-full h-36 bg-muted dark:bg-white/5 rounded-xl mb-3 animate-pulse" />
              <div className="space-y-2">
                <div className="w-1/3 h-4 bg-muted dark:bg-white/5 rounded animate-pulse" />
                <div className="w-4/5 h-3 bg-muted dark:bg-white/5 rounded animate-pulse" />
              </div>
              <div className="pt-3 border-t border-border dark:border-white/5 flex justify-between">
                <div className="w-12 h-2.5 bg-muted dark:bg-white/5 rounded animate-pulse" />
                <div className="w-12 h-2.5 bg-muted dark:bg-white/5 rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        /* 错误重试态 */
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">{t('FriendsLoadFailed')}</p>
          <button
            type="button"
            onClick={fetchFriendLinks}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 border border-border dark:bg-white/10 dark:hover:bg-white/20 dark:border-transparent text-foreground transition-colors cursor-pointer"
          >
            <RefreshCw size={13} />
            <span>{t('FriendsRetry')}</span>
          </button>
        </div>
      ) : processedItems.length === 0 ? (
        /* 空状态卡片 */
        <div className="py-16 text-center max-w-md mx-auto rounded-2xl border border-dashed border-border dark:border-white/10 p-8 bg-card/60 dark:bg-[#1e1e21]/40 shadow-sm">
          <Sparkles size={28} className="text-[#d4a958] mx-auto mb-3 opacity-60" />
          <h3 className="text-base font-semibold text-foreground mb-1.5">
            {searchQuery ? t('FriendsEmptySearch') : t('FriendsEmptyNone')}
          </h3>
          <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
            {t('FriendsEmptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-xs bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] font-semibold hover:shadow-[0_0_20px_rgba(212,169,88,0.25)] transition-all cursor-pointer"
          >
            <span>{t('FriendsEmptyApplyBtn')}</span>
          </button>
        </div>
      ) : (
        /* 正常卡片网格 (1列 / 2列 / 3列) */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {processedItems.map((item, index) => (
            <FriendCard key={item.id} item={item} lang={lang} index={index} />
          ))}
        </div>
      )}

      {/* 友链申请交互弹窗 */}
      <FriendApplyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
        turnstileSiteKey={turnstileSiteKey}
      />
    </div>
  );
}
