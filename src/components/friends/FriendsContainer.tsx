'use client';

import { Icon } from '@iconify/react';
import { X } from 'lucide-react';
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

  const fetchFriendLinks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const all: FriendLinkItem[] = [];
      let page = 1;
      let hasNext = true;
      while (hasNext) {
        const res = await fetch(`/api/v1/friend-links?page=${page}&pageSize=100`);
        const body = (await res.json()) as {
          success?: boolean;
          data?: { items?: FriendLinkItem[]; hasNextPage?: boolean };
        };
        if (!res.ok || !body.success || !body.data?.items) throw new Error('Failed to load');
        all.push(...body.data.items);
        hasNext = body.data.hasNextPage === true;
        page++;
      }
      setItems(all);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFriendLinks();
  }, [fetchFriendLinks]);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return items;
    return items.filter((item) =>
      [item.name, item.url, item.description].some((v) => v?.toLowerCase().includes(q)),
    );
  }, [items, searchQuery]);

  const scrollToGuide = () => {
    document.getElementById('exchange-guide')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Hero */}
      <FriendsHero
        lang={lang}
        onApplyClick={() => setModalOpen(true)}
        onGuideClick={scrollToGuide}
      />

      {/* 交换指南 */}
      <ExchangeGuideCard lang={lang} />

      {/* ── 列表头：标题 + 搜索 ── */}
      <div className="mb-7 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <Icon
            icon="ph:compass-duotone"
            width={20}
            height={20}
            className="text-amber-600 dark:text-[#d4a958]"
          />
          <h2 className="text-lg font-bold text-foreground">{t('FriendsSectionTitle')}</h2>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-mono tabular-nums bg-muted/60 dark:bg-white/5 border border-border/60 dark:border-white/8 text-sky-600 dark:text-[#83a9b9]">
            {filtered.length}
          </span>
        </div>

        <div className="relative w-full sm:w-64">
          <Icon
            icon="ph:magnifying-glass"
            width={14}
            height={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('FriendsSearchPlaceholder')}
            className="w-full pl-8 pr-7 py-1.5 rounded-lg bg-card border border-border/60 dark:bg-[#1e1e21] dark:border-white/8 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-amber-500/60 dark:focus:border-[#d4a958]/50 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* ── 内容区 ── */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
            <div
              key={key}
              className="rounded-2xl bg-card border border-border/60 dark:bg-[#1e1e21] dark:border-white/5 h-60 overflow-hidden p-4 flex flex-col justify-between animate-pulse"
            >
              <div className="flex items-center gap-3">
                <div className="size-11 rounded-full bg-muted dark:bg-white/5" />
                <div className="space-y-1.5 flex-1">
                  <div className="w-1/3 h-3.5 bg-muted dark:bg-white/5 rounded" />
                  <div className="w-2/5 h-2.5 bg-muted dark:bg-white/5 rounded" />
                </div>
              </div>
              <div className="w-4/5 h-2.5 bg-muted dark:bg-white/5 rounded mt-3" />
              <div className="flex-1 mt-3 rounded-xl bg-muted dark:bg-white/5" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <p className="text-sm text-muted-foreground mb-4">{t('FriendsLoadFailed')}</p>
          <button
            type="button"
            onClick={fetchFriendLinks}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-muted/80 border border-border/60 dark:bg-white/5 dark:hover:bg-white/8 dark:border-white/5 text-foreground transition-colors cursor-pointer"
          >
            <Icon icon="ph:arrow-clockwise-bold" width={13} height={13} />
            <span>{t('FriendsRetry')}</span>
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center max-w-sm mx-auto rounded-2xl border border-dashed border-border/60 dark:border-white/8 p-8 bg-card/50 dark:bg-[#1e1e21]/30">
          <Icon
            icon="ph:sparkle-duotone"
            width={28}
            height={28}
            className="text-[#d4a958] mx-auto mb-3 opacity-60"
          />
          <h3 className="text-base font-semibold text-foreground mb-1.5">
            {searchQuery ? t('FriendsEmptySearch') : t('FriendsEmptyNone')}
          </h3>
          <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
            {t('FriendsEmptyDesc')}
          </p>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] hover:shadow-[0_0_20px_rgba(212,169,88,0.25)] transition-all cursor-pointer"
          >
            <Icon icon="ph:paper-plane-tilt-fill" width={14} height={14} />
            <span>{t('FriendsEmptyApplyBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((item, i) => (
            <FriendCard key={item.id} item={item} lang={lang} index={i} />
          ))}
        </div>
      )}

      {/* Modal */}
      <FriendApplyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        lang={lang}
        turnstileSiteKey={turnstileSiteKey}
      />
    </div>
  );
}
