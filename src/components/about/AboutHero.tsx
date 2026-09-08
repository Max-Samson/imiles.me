'use client';
import type { ReactNode } from 'react';
import Phonetic from '@/components/article/Phonetic';
import SocialLinksGrid from '@/components/layout/SocialLinksGrid';
import { type Locale, useTranslations } from '@/lib/i18n';
import { AuroraText } from '@/registry/magicui/aurora-text';

interface AboutHeroProps {
  lang: Locale;
  children: ReactNode;
}

export default function AboutHero({ lang, children }: AboutHeroProps) {
  const { t } = useTranslations(lang);
  const role =
    lang === 'zh'
      ? '全栈 Web 工程师，关注 AI、全栈产品、工程体验与长期写作。'
      : 'Full-stack web engineer focused on AI, full-stack products, developer experience, and long-form writing.';
  return (
    <main className="relative mx-auto max-w-3xl px-6 pt-24 pb-16">
      <div className="mb-5">
        <h1 className="text-4xl font-bold" style={{ fontFamily: 'Rock Salt, cursive' }}>
          <AuroraText>Miles</AuroraText>
        </h1>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Phonetic ipa={role} className="text-base md:text-lg" />
        </div>
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        {children}
        <h2>{t('ContactTitle')}</h2>
        <SocialLinksGrid />
      </div>
    </main>
  );
}
