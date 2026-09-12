'use client';
import type { Locale } from '@/lib/i18n';
import LandingExperience from './LandingExperience';

export default function Hero({ lang }: { lang: Locale }) {
  return <LandingExperience lang={lang} />;
}
