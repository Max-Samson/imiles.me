'use client';

import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ExchangeGuideCardProps {
  lang: Locale;
  /** 外部控制是否受控展开，如未传入则内部自主控制 */
  isOpen?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const MY_SITE = {
  name: "Miles's Digital Garden",
  url: 'https://imiles.me',
  logo: 'https://imiles.me/images/weblogo.jpeg',
};

type CodeFormat = 'yaml' | 'json' | 'markdown' | 'html';

const FORMAT_CONFIG: Record<CodeFormat, { icon: string; label: string }> = {
  yaml: { icon: 'ph:file-text-duotone', label: 'YAML' },
  json: { icon: 'ph:brackets-curly-duotone', label: 'JSON' },
  markdown: { icon: 'ph:markdown-logo-duotone', label: 'Markdown' },
  html: { icon: 'ph:code-duotone', label: 'HTML' },
};

/** 约定准则图标 */
const RULE_ICONS = ['ph:notebook-duotone', 'ph:shield-check-duotone', 'ph:handshake-duotone'];

export default function ExchangeGuideCard({
  lang,
  isOpen: externalOpen,
  onToggle,
}: ExchangeGuideCardProps) {
  const { t } = useTranslations(lang);
  const [internalOpen, setInternalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'rules'>('config');
  const [fmt, setFmt] = useState<CodeFormat>('yaml');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const isExpanded = externalOpen !== undefined ? externalOpen : internalOpen;

  const handleToggle = () => {
    const next = !isExpanded;
    if (externalOpen === undefined) {
      setInternalOpen(next);
    }
    onToggle?.(next);
  };

  const copy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      // 容错处理
    }
  };

  const desc = t('FriendsMySiteBio');

  const snippet = (f: CodeFormat): string => {
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

  const quickFields = [
    { key: 'name', label: t('FriendsMySiteNameLabel'), value: MY_SITE.name },
    { key: 'url', label: t('FriendsMySiteUrlLabel'), value: MY_SITE.url },
    { key: 'logo', label: 'Logo', value: MY_SITE.logo },
    { key: 'desc', label: t('FriendsMySiteDescLabel'), value: desc },
  ];

  return (
    <section id="exchange-guide" className="relative mx-auto mb-10 max-w-4xl scroll-mt-20">
      {/* ── 胶囊折叠触发展示栏（收起时仅占一横条，轻盈不抢戏） ── */}
      <div
        className={cn(
          'group relative overflow-hidden rounded-2xl border transition-all duration-300',
          'border-border/60 bg-card/70 backdrop-blur-md dark:border-white/8 dark:bg-[#151518]/70',
          isExpanded
            ? 'shadow-lg ring-1 ring-amber-500/20 dark:ring-[#d4a958]/20'
            : 'hover:border-amber-500/30 hover:bg-card/90 dark:hover:border-[#d4a958]/30 dark:hover:bg-[#18181c]/80 shadow-xs',
        )}
      >
        {/* 背景微环境光 */}
        <div className="pointer-events-none absolute -right-20 -top-20 size-60 rounded-full bg-gradient-to-br from-amber-500/10 via-sky-500/5 to-transparent blur-3xl" />

        {/* 触发横幅 Header */}
        <button
          type="button"
          onClick={handleToggle}
          aria-expanded={isExpanded}
          aria-controls="exchange-guide-content"
          className="flex w-full items-center justify-between gap-4 p-4 text-left sm:px-6 sm:py-4.5 cursor-pointer select-none"
        >
          {/* 左侧：Logo + 快速指引 */}
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative size-10 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/40 shadow-xs dark:border-white/10 dark:bg-white/5">
              <img
                src={MY_SITE.logo}
                alt={MY_SITE.name}
                className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                width={40}
                height={40}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm sm:text-base text-foreground tracking-tight">
                  {t('FriendsGuideTitle')}
                </span>
                <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-[#d4a958]/15 dark:text-[#f3d289]">
                  <Icon icon="ph:sparkle-fill" width={11} height={11} />
                  <span>{t('FriendsGuideBadge')}</span>
                </span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {isExpanded ? t('FriendsGuideCollapsePrompt') : t('FriendsGuideExpandPrompt')}
              </p>
            </div>
          </div>

          {/* 右侧：状态指示与箭头 */}
          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline-block text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {isExpanded ? t('FriendsGuideCollapseAction') : t('FriendsGuideExpandAction')}
            </span>
            <span
              className={cn(
                'flex size-8 items-center justify-center rounded-lg border border-border/50 bg-muted/30 text-muted-foreground transition-all duration-300 dark:border-white/8 dark:bg-white/5 group-hover:text-foreground group-hover:border-border',
                isExpanded &&
                  'rotate-180 bg-amber-500/10 text-amber-700 border-amber-500/30 dark:bg-[#d4a958]/15 dark:text-[#d4a958] dark:border-[#d4a958]/30',
              )}
            >
              <Icon icon="ph:caret-down-bold" width={14} height={14} />
            </span>
          </div>
        </button>

        {/* ── 展开内容区：纯粹、紧凑、优雅 ── */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              id="exchange-guide-content"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden border-t border-border/50 dark:border-white/8"
            >
              <div className="p-4 sm:p-6 space-y-6">
                {/* 视图切换 Tabs：本站配置 vs 互换准则 */}
                <div className="flex items-center justify-between gap-3 border-b border-border/40 dark:border-white/5 pb-4">
                  <div className="flex items-center gap-1.5 rounded-xl bg-muted/60 p-1 dark:bg-white/5 border border-border/40 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('config')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer',
                        activeTab === 'config'
                          ? 'bg-background text-foreground shadow-xs dark:bg-[#1f1f24] font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon icon="ph:code-bold" width={14} height={14} />
                      <span>{t('FriendsGuideTabConfig')}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('rules')}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer',
                        activeTab === 'rules'
                          ? 'bg-background text-foreground shadow-xs dark:bg-[#1f1f24] font-semibold'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      <Icon icon="ph:shield-check-bold" width={14} height={14} />
                      <span>{t('FriendsGuideTabRules')}</span>
                    </button>
                  </div>

                  {/* 快捷跳转/辅助说明 */}
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                    <Icon icon="ph:info" width={13} height={13} />
                    <span>{t('FriendsGuidePreCondition')}</span>
                  </span>
                </div>

                {/* Tab 1: 本站配置一览 + 格式代码块 */}
                {activeTab === 'config' && (
                  <div className="space-y-4">
                    {/* 精致微型名片条 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                      {quickFields.map((field) => (
                        <div
                          key={field.key}
                          className="flex items-center justify-between gap-2 rounded-xl border border-border/40 bg-muted/30 p-2.5 dark:border-white/5 dark:bg-white/[0.02]"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] text-muted-foreground uppercase font-mono">
                              {field.label}
                            </span>
                            <span
                              className="block truncate text-xs font-medium text-foreground mt-0.5"
                              title={field.value}
                            >
                              {field.value}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => copy(field.value, field.key)}
                            title={`${t('FriendsGuideCopyFieldPrefix')} ${field.label}`}
                            className="flex size-7 shrink-0 items-center justify-center rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-white/10 transition-colors cursor-pointer"
                          >
                            {copiedKey === field.key ? (
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
                      ))}
                    </div>

                    {/* 代码格式切换与预览 */}
                    <div className="rounded-xl border border-border/60 bg-muted/20 dark:border-white/5 dark:bg-[#121214] p-3.5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        {/* 格式选择标签 */}
                        <div className="flex items-center gap-1">
                          {(['yaml', 'json', 'markdown', 'html'] as const).map((format) => {
                            const active = fmt === format;
                            const item = FORMAT_CONFIG[format];
                            return (
                              <button
                                key={format}
                                type="button"
                                onClick={() => setFmt(format)}
                                className={cn(
                                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer',
                                  active
                                    ? 'bg-amber-500/15 text-amber-700 dark:bg-[#d4a958]/20 dark:text-[#f7d188] font-semibold border border-amber-500/30 dark:border-[#d4a958]/30 shadow-2xs'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 dark:hover:bg-white/5',
                                )}
                              >
                                <Icon icon={item.icon} width={12} height={12} />
                                <span>{item.label}</span>
                              </button>
                            );
                          })}
                        </div>

                        {/* 一键复制代码 */}
                        <button
                          type="button"
                          onClick={() => copy(snippet(fmt), `snippet_${fmt}`)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer active:scale-95 border',
                            copiedKey === `snippet_${fmt}`
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                              : 'border-border/60 bg-background hover:bg-muted dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10 text-foreground',
                          )}
                        >
                          {copiedKey === `snippet_${fmt}` ? (
                            <>
                              <Icon
                                icon="ph:check-bold"
                                width={13}
                                height={13}
                                className="text-emerald-500"
                              />
                              <span>{t('FriendsCopied')}</span>
                            </>
                          ) : (
                            <>
                              <Icon icon="ph:copy-bold" width={13} height={13} />
                              <span>{t('FriendsCopyConfig')}</span>
                            </>
                          )}
                        </button>
                      </div>

                      {/* 纯净代码块 */}
                      <pre className="overflow-x-auto rounded-lg bg-background/80 p-3 font-mono text-[11px] leading-relaxed text-foreground/90 dark:bg-[#0c0c0e]/80 border border-border/30 dark:border-white/5">
                        <code>{snippet(fmt)}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* Tab 2: 互换准则要点 */}
                {activeTab === 'rules' && (
                  <div className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('FriendsGuideSubtitle')}
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {rules.map((rule, idx) => (
                        <div
                          key={RULE_ICONS[idx]}
                          className="flex flex-col justify-between rounded-xl border border-border/50 bg-muted/20 p-4 dark:border-white/5 dark:bg-white/[0.02] space-y-2.5"
                        >
                          <div className="flex items-center gap-2.5">
                            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                              <Icon icon={RULE_ICONS[idx]} width={16} height={16} />
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {t('FriendsGuideRuleItemPrefix')} 0{idx + 1}
                            </span>
                          </div>
                          <p className="text-xs leading-relaxed text-muted-foreground flex-1">
                            {rule}
                          </p>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-xs text-amber-800 dark:border-[#d4a958]/20 dark:bg-[#d4a958]/5 dark:text-[#e4be6b]">
                      <Icon
                        icon="ph:lightbulb-filament-duotone"
                        width={16}
                        height={16}
                        className="shrink-0"
                      />
                      <span>{t('FriendsGuideTip')}</span>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}
