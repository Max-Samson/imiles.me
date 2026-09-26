'use client';

import { Check, Copy, ShieldCheck, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import FriendCard from './FriendCard';

interface ExchangeGuideCardProps {
  lang: Locale;
}

const MY_SITE_INFO = {
  name: "Miles's Digital Garden",
  url: 'https://imiles.me',
  avatar: 'https://imiles.me/images/avatar.png',
};

type CodeFormat = 'yaml' | 'json' | 'markdown' | 'html';

export default function ExchangeGuideCard({ lang }: ExchangeGuideCardProps) {
  const { t } = useTranslations(lang);
  const [activeFormat, setActiveFormat] = useState<CodeFormat>('yaml');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      // 剪贴板降级
    }
  };

  const getCodeSnippet = (format: CodeFormat): string => {
    const desc = t('FriendsMySiteBio');
    switch (format) {
      case 'yaml':
        return `- name: "${MY_SITE_INFO.name}"
  url: "${MY_SITE_INFO.url}"
  avatar: "${MY_SITE_INFO.avatar}"
  description: "${desc}"`;
      case 'json':
        return JSON.stringify(
          {
            name: MY_SITE_INFO.name,
            url: MY_SITE_INFO.url,
            avatar: MY_SITE_INFO.avatar,
            description: desc,
          },
          null,
          2,
        );
      case 'markdown':
        return `[![${MY_SITE_INFO.name}](${MY_SITE_INFO.avatar})](${MY_SITE_INFO.url} "${desc}")`;
      case 'html':
        return `<a href="${MY_SITE_INFO.url}" target="_blank" rel="noopener noreferrer" title="${desc}">
  <img src="${MY_SITE_INFO.avatar}" alt="${MY_SITE_INFO.name}" width="32" height="32" />
  <span>${MY_SITE_INFO.name}</span>
</a>`;
    }
  };

  return (
    <section id="exchange-guide" className="relative max-w-6xl mx-auto mb-16">
      {/* 背景柔和环境光斑（自适应亮暗两色） */}
      <div className="absolute top-0 right-1/4 w-96 h-48 bg-amber-500/[0.07] dark:bg-[#d4a958]/10 blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-0 left-1/4 w-96 h-48 bg-sky-500/[0.07] dark:bg-[#83a9b9]/10 blur-3xl pointer-events-none -z-10" />

      {/* 并列平等双翼布局：左侧规则与配置工具箱 + 右侧大尺寸主角 FriendCard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        {/* 左翼：友链交换约定与接入工具面板 (5列) */}
        <div className="lg:col-span-5 rounded-2xl border border-border/80 dark:border-white/10 bg-card/85 dark:bg-[#161619]/90 backdrop-blur-md p-6 sm:p-7 flex flex-col justify-between shadow-sm space-y-6">
          {/* 1. 顶部：交换约定与准则 */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-[#10b981]/15 dark:text-[#10b981]">
                <ShieldCheck size={18} />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">
                {t('FriendsGuideTitle')}
              </h3>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4">
              {t('FriendsGuideSubtitle')}
            </p>

            <ul className="space-y-3 text-xs sm:text-sm text-foreground/90">
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-[#10b981]/20 dark:text-[#10b981] flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span className="leading-normal">{t('FriendsRuleOne')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-[#10b981]/20 dark:text-[#10b981] flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span className="leading-normal">{t('FriendsRuleTwo')}</span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex-shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-500/15 text-emerald-600 dark:bg-[#10b981]/20 dark:text-[#10b981] flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <span className="leading-normal">{t('FriendsRuleThree')}</span>
              </li>
            </ul>

            {/* 提示微标 */}
            <div className="mt-4 p-3 rounded-xl bg-amber-500/[0.05] border border-amber-500/15 text-foreground/80 dark:bg-white/[0.02] dark:border-white/5 dark:text-muted-foreground flex items-center gap-2 text-xs">
              <Sparkles size={14} className="text-amber-600 dark:text-[#d4a958] flex-shrink-0" />
              <span>{t('FriendsGuideTip')}</span>
            </div>
          </div>

          {/* 2. 中部：单项快速复制工具 */}
          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 dark:bg-white/[0.02] border border-border/80 dark:border-white/5 transition-colors">
              <span className="text-muted-foreground">{t('FriendsMySiteNameLabel')}:</span>
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">{MY_SITE_INFO.name}</span>
                <button
                  type="button"
                  onClick={() => copyText(MY_SITE_INFO.name, 'name')}
                  className="p-1 text-muted-foreground hover:text-amber-600 dark:hover:text-[#d4a958] transition-colors cursor-pointer"
                  title="Copy"
                  aria-label="Copy site name"
                >
                  {copiedKey === 'name' ? (
                    <Check size={13} className="text-emerald-600 dark:text-[#10b981]" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/50 dark:bg-white/[0.02] border border-border/80 dark:border-white/5 transition-colors">
              <span className="text-muted-foreground">{t('FriendsMySiteUrlLabel')}:</span>
              <div className="flex items-center gap-2">
                <span className="text-sky-600 dark:text-[#83a9b9]">{MY_SITE_INFO.url}</span>
                <button
                  type="button"
                  onClick={() => copyText(MY_SITE_INFO.url, 'url')}
                  className="p-1 text-muted-foreground hover:text-amber-600 dark:hover:text-[#d4a958] transition-colors cursor-pointer"
                  title="Copy"
                  aria-label="Copy site url"
                >
                  {copiedKey === 'url' ? (
                    <Check size={13} className="text-emerald-600 dark:text-[#10b981]" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
            </div>

            <div className="p-2 rounded-lg bg-muted/50 dark:bg-white/[0.02] border border-border/80 dark:border-white/5 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <span className="text-muted-foreground">{t('FriendsMySiteDescLabel')}:</span>
                <button
                  type="button"
                  onClick={() => copyText(t('FriendsMySiteBio'), 'bio')}
                  className="p-1 text-muted-foreground hover:text-amber-600 dark:hover:text-[#d4a958] transition-colors cursor-pointer"
                  title="Copy"
                  aria-label="Copy site description"
                >
                  {copiedKey === 'bio' ? (
                    <Check size={13} className="text-emerald-600 dark:text-[#10b981]" />
                  ) : (
                    <Copy size={13} />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground font-sans line-clamp-2">
                {t('FriendsMySiteBio')}
              </p>
            </div>
          </div>

          {/* 3. 底部：多格式配置代码切换与一键导出 */}
          <div className="pt-2 border-t border-border/60 dark:border-white/5">
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-1 bg-muted/60 dark:bg-[#121214] p-1 rounded-xl border border-border/80 dark:border-white/5 text-xs font-mono">
                {(['yaml', 'json', 'markdown', 'html'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => setActiveFormat(fmt)}
                    className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer uppercase text-[11px] ${
                      activeFormat === fmt
                        ? 'bg-[#d4a958] text-[#121214] font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              {/* 复制代码按钮 */}
              <button
                type="button"
                onClick={() => copyText(getCodeSnippet(activeFormat), `snippet_${activeFormat}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted/80 hover:bg-muted text-foreground border border-border dark:bg-white/5 dark:hover:bg-white/10 dark:border-white/5 transition-all cursor-pointer active:scale-95 shadow-sm"
              >
                {copiedKey === `snippet_${activeFormat}` ? (
                  <>
                    <Check size={13} className="text-emerald-600 dark:text-[#10b981]" />
                    <span className="text-emerald-600 dark:text-[#10b981] font-medium">
                      {t('FriendsCopied')}
                    </span>
                  </>
                ) : (
                  <>
                    <Copy size={13} />
                    <span>{t('FriendsCopyConfig')}</span>
                  </>
                )}
              </button>
            </div>

            {/* 代码预览展示区 */}
            <div className="relative rounded-xl bg-muted/40 dark:bg-[#121214] border border-border/80 dark:border-white/5 p-3.5 font-mono text-[11px] overflow-x-auto text-foreground/90 shadow-inner">
              <pre className="whitespace-pre leading-relaxed font-mono">
                <code>{getCodeSnippet(activeFormat)}</code>
              </pre>
            </div>
          </div>
        </div>

        {/* 右翼：震撼放大的本站 FriendCard 展位 (7列，无嵌套边框) */}
        <div className="lg:col-span-7 flex flex-col">
          <FriendCard
            lang={lang}
            size="large"
            name={MY_SITE_INFO.name}
            url={MY_SITE_INFO.url}
            avatarUrl={MY_SITE_INFO.avatar}
            description={t('FriendsMySiteBio')}
            interactive={true}
            className="w-full h-full shadow-md hover:shadow-2xl border-border/80 dark:border-white/10"
          />
        </div>
      </div>
    </section>
  );
}
