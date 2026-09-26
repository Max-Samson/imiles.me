'use client';

import { ArrowDown, Sparkles, UserPlus } from 'lucide-react';
import { motion } from 'motion/react';
import { type Locale, useTranslations } from '@/lib/i18n';

interface FriendsHeroProps {
  lang: Locale;
  onApplyClick: () => void;
  onGuideClick: () => void;
}

export default function FriendsHero({ lang, onApplyClick, onGuideClick }: FriendsHeroProps) {
  const { t } = useTranslations(lang);

  return (
    <div className="relative pt-12 pb-10 sm:pt-16 sm:pb-14 text-center max-w-3xl mx-auto px-4">
      {/* 顶部中央环境微光 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-64 bg-gradient-to-tr from-[#d4a958]/10 via-[#83a9b9]/10 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* 顶部微光徽章 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-medium bg-card border border-amber-500/30 text-amber-700 dark:text-[#d4a958] dark:bg-[#1e1e21] mb-6 shadow-sm dark:shadow-[0_0_20px_rgba(212,169,88,0.15)]"
      >
        <Sparkles size={13} className="text-amber-600 dark:text-[#d4a958]" />
        <span>{t('FriendsEyebrow')}</span>
      </motion.div>

      {/* 主标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.2] mb-6"
      >
        {t('FriendsHeroTitlePre')}
        <span className="bg-gradient-to-r from-[#d4a958] via-[#f7d188] to-[#83a9b9] bg-clip-text text-transparent">
          {t('FriendsHeroTitleHighlight')}
        </span>
      </motion.h1>

      {/* 副标题 */}
      <motion.p
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-2xl mx-auto mb-8"
      >
        {t('FriendsHeroIntro')}
      </motion.p>

      {/* 快捷操作按钮组 */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="flex flex-wrap items-center justify-center gap-3.5"
      >
        <button
          type="button"
          onClick={onApplyClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] font-semibold hover:shadow-[0_0_25px_rgba(212,169,88,0.4)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <UserPlus size={16} />
          <span>{t('FriendsApplyBtn')}</span>
        </button>

        <button
          type="button"
          onClick={onGuideClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-card hover:bg-muted border border-border hover:border-sky-500/40 dark:bg-[#1e1e21]/80 dark:hover:bg-[#1e1e21] dark:border-white/10 dark:hover:border-[#83a9b9]/40 text-foreground transition-all duration-300 shadow-sm cursor-pointer"
        >
          <ArrowDown size={15} className="text-[#83a9b9]" />
          <span>{t('FriendsGuideBtn')}</span>
        </button>
      </motion.div>
    </div>
  );
}
