'use client';

import { Icon } from '@iconify/react';
import { useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import FriendCard from './FriendCard';

interface ExchangeGuideCardProps {
  lang: Locale;
}

const MY_SITE = {
  name: "Miles's Digital Garden",
  url: 'https://imiles.me',
  logo: 'https://imiles.me/images/weblogo.jpeg',
};

type CodeFormat = 'yaml' | 'json' | 'markdown' | 'html';

const FORMAT_ICONS: Record<CodeFormat, string> = {
  yaml: 'ph:file-text-duotone',
  json: 'ph:brackets-curly-duotone',
  markdown: 'ph:markdown-logo-duotone',
  html: 'ph:code-duotone',
};

/** 规则列表，每条带独立的语义化 Iconify 图标 */
const RULE_ICONS = [
  'ph:notebook-duotone', // 独立博客 / 数字花园
  'ph:heart-half-duotone', // 真诚原创、热爱分享
  'ph:handshake-duotone', // 互相添加、长期维护
];

export default function ExchangeGuideCard({ lang }: ExchangeGuideCardProps) {
  const { t } = useTranslations(lang);
  const [fmt, setFmt] = useState<CodeFormat>('yaml');
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* 降级 */
    }
  };

  const snippet = (f: CodeFormat): string => {
    const desc = t('FriendsMySiteBio');
    switch (f) {
      case 'yaml':
        return `- name: "${MY_SITE.name}"\n  url: "${MY_SITE.url}"\n  logo: "${MY_SITE.logo}"\n  description: "${desc}"`;
      case 'json':
        return JSON.stringify(
          { name: MY_SITE.name, url: MY_SITE.url, logo: MY_SITE.logo, description: desc },
          null,
          2,
        );
      case 'markdown':
        return `[![${MY_SITE.name}](${MY_SITE.logo})](${MY_SITE.url} "${desc}")`;
      case 'html':
        return `<a href="${MY_SITE.url}" target="_blank" rel="noopener noreferrer" title="${desc}">\n  <img src="${MY_SITE.logo}" alt="${MY_SITE.name}" width="32" height="32" />\n  <span>${MY_SITE.name}</span>\n</a>`;
    }
  };

  const rules = [t('FriendsRuleOne'), t('FriendsRuleTwo'), t('FriendsRuleThree')];

  // 快速复制行
  const fields: { key: string; label: string; value: string; color?: string }[] = [
    { key: 'name', label: t('FriendsMySiteNameLabel'), value: MY_SITE.name },
    {
      key: 'url',
      label: t('FriendsMySiteUrlLabel'),
      value: MY_SITE.url,
      color: 'text-sky-600 dark:text-[#83a9b9]',
    },
    { key: 'logo', label: 'Logo', value: MY_SITE.logo },
    { key: 'bio', label: t('FriendsMySiteDescLabel'), value: t('FriendsMySiteBio') },
  ];

  return (
    <section id="exchange-guide" className="relative max-w-6xl mx-auto mb-14">
      {/* 环境光 */}
      <div className="absolute top-0 right-1/4 w-80 h-40 bg-amber-500/5 dark:bg-[#d4a958]/8 blur-3xl pointer-events-none -z-10" />

      {/* ── 本站名片：全宽展示 ── */}
      <div className="mb-8">
        <FriendCard
          lang={lang}
          size="large"
          name={MY_SITE.name}
          url={MY_SITE.url}
          logoUrl={MY_SITE.logo}
          description={t('FriendsMySiteBio')}
          interactive
          className="w-full shadow-md hover:shadow-xl"
        />
      </div>

      {/* ── 交换指南 + 代码配置：双列自然流动 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* 左：交换准则 */}
        <div className="rounded-2xl border border-border/60 dark:border-white/8 bg-card/80 dark:bg-[#161619]/80 backdrop-blur-sm p-5 sm:p-6 space-y-5">
          {/* 标题 */}
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 dark:bg-emerald-500/15">
              <Icon
                icon="ph:shield-check-duotone"
                width={18}
                height={18}
                className="text-emerald-600 dark:text-emerald-400"
              />
            </span>
            <h3 className="text-base font-bold text-foreground">{t('FriendsGuideTitle')}</h3>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            {t('FriendsGuideSubtitle')}
          </p>

          {/* 规则列表 */}
          <ul className="space-y-3">
            {rules.map((rule, i) => (
              <li key={RULE_ICONS[i]} className="flex items-start gap-3 text-sm text-foreground/85">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-emerald-500/8 dark:bg-emerald-500/10 mt-0.5">
                  <Icon
                    icon={RULE_ICONS[i]}
                    width={15}
                    height={15}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                </span>
                <span className="leading-normal text-xs">{rule}</span>
              </li>
            ))}
          </ul>

          {/* 提示条 */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/5 border border-amber-500/10 dark:bg-white/[0.02] dark:border-white/5 px-3.5 py-2.5 text-xs text-foreground/70">
            <Icon
              icon="ph:lightbulb-filament-duotone"
              width={15}
              height={15}
              className="text-amber-600 dark:text-[#d4a958] shrink-0"
            />
            <span>{t('FriendsGuideTip')}</span>
          </div>
        </div>

        {/* 右：本站信息 + 代码片段 */}
        <div className="rounded-2xl border border-border/60 dark:border-white/8 bg-card/80 dark:bg-[#161619]/80 backdrop-blur-sm p-5 sm:p-6 flex flex-col justify-between space-y-5">
          {/* 快速复制行 */}
          <div className="space-y-2">
            {fields.map((f) => (
              <div
                key={f.key}
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 dark:bg-white/[0.02] border border-border/50 dark:border-white/5 px-3 py-2 text-xs font-mono"
              >
                <span className="text-muted-foreground shrink-0">{f.label}</span>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className={cn('truncate font-medium', f.color || 'text-foreground')}
                    title={f.value}
                  >
                    {f.value}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(f.value, f.key)}
                    className="shrink-0 p-0.5 text-muted-foreground hover:text-amber-600 dark:hover:text-[#d4a958] transition-colors cursor-pointer"
                    title="Copy"
                    aria-label={`Copy ${f.label}`}
                  >
                    {copied === f.key ? (
                      <Icon
                        icon="ph:check-bold"
                        width={13}
                        height={13}
                        className="text-emerald-500"
                      />
                    ) : (
                      <Icon icon="ph:copy-duotone" width={13} height={13} />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* 格式切换 + 代码块 */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              {/* 格式标签 */}
              <div className="flex items-center gap-1 bg-muted/50 dark:bg-[#121214] p-0.5 rounded-lg border border-border/50 dark:border-white/5">
                {(['yaml', 'json', 'markdown', 'html'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFmt(f)}
                    className={cn(
                      'inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-mono uppercase transition-all cursor-pointer',
                      fmt === f
                        ? 'bg-[#d4a958] text-[#121214] font-bold shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <Icon icon={FORMAT_ICONS[f]} width={11} height={11} />
                    {f}
                  </button>
                ))}
              </div>

              {/* 复制 */}
              <button
                type="button"
                onClick={() => copy(snippet(fmt), `snippet_${fmt}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium bg-muted/60 hover:bg-muted border border-border/50 dark:bg-white/5 dark:hover:bg-white/8 dark:border-white/5 text-foreground transition-all cursor-pointer active:scale-95"
              >
                {copied === `snippet_${fmt}` ? (
                  <>
                    <Icon
                      icon="ph:check-bold"
                      width={12}
                      height={12}
                      className="text-emerald-500"
                    />
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {t('FriendsCopied')}
                    </span>
                  </>
                ) : (
                  <>
                    <Icon icon="ph:copy-duotone" width={12} height={12} />
                    <span>{t('FriendsCopyConfig')}</span>
                  </>
                )}
              </button>
            </div>

            {/* 代码展示 */}
            <div className="rounded-xl bg-muted/30 dark:bg-[#121214] border border-border/50 dark:border-white/5 p-3.5 font-mono text-[11px] overflow-x-auto text-foreground/85">
              <pre className="whitespace-pre leading-relaxed">
                <code>{snippet(fmt)}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
