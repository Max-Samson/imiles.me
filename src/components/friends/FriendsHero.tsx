'use client';

import { Icon } from '@iconify/react';
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
    <div className="relative pt-10 pb-8 sm:pt-14 sm:pb-12 text-center max-w-3xl mx-auto px-4">
      {/* 环境光 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-56 bg-gradient-to-tr from-amber-400/8 via-sky-400/6 to-transparent blur-3xl pointer-events-none -z-10" />

      {/* 徽章 */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] font-medium tracking-wide uppercase bg-card border border-amber-500/20 text-amber-700 dark:text-[#d4a958] dark:bg-[#1e1e21] mb-7 shadow-sm"
      >
        <Icon icon="ph:globe-hemisphere-west-duotone" width={15} height={15} />
        <span>{t('FriendsEyebrow')}</span>
      </motion.div>

      {/* 主标题 */}
      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="text-3xl sm:text-5xl font-extrabold tracking-tight text-foreground leading-[1.15] mb-5"
      >
        {t('FriendsHeroTitlePre')}
        <span className="bg-gradient-to-r from-[#d4a958] via-[#f7d188] to-[#83a9b9] bg-clip-text text-transparent">
          {t('FriendsHeroTitleHighlight')}
        </span>
      </motion.h1>

      {/* 副标题 */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-xl mx-auto mb-9"
      >
        {t('FriendsHeroIntro')}
      </motion.p>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.22 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
        <button
          type="button"
          onClick={onApplyClick}
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] hover:shadow-[0_0_24px_rgba(212,169,88,0.35)] transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
        >
          <Icon icon="ph:paper-plane-tilt-fill" width={16} height={16} />
          <span>{t('FriendsApplyBtn')}</span>
        </button>

        <button
          type="button"
          onClick={onGuideClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm bg-card hover:bg-muted border border-border hover:border-sky-500/30 dark:bg-[#1e1e21]/80 dark:hover:bg-[#1e1e21] dark:border-white/10 dark:hover:border-[#83a9b9]/30 text-foreground transition-all duration-300 shadow-sm cursor-pointer"
        >
          <Icon icon="ph:scroll-duotone" width={16} height={16} className="text-[#83a9b9]" />
          <span>{t('FriendsGuideBtn')}</span>
        </button>
      </motion.div>
    </div>
  );
}
