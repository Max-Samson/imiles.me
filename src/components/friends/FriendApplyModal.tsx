'use client';

import { Icon } from '@iconify/react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import FriendCard from './FriendCard';
import TurnstileWidget from './TurnstileWidget';

interface FriendApplyModalProps {
  open: boolean;
  onClose: () => void;
  lang: Locale;
  turnstileSiteKey: string;
}

export default function FriendApplyModal({
  open,
  onClose,
  lang,
  turnstileSiteKey,
}: FriendApplyModalProps) {
  const { t } = useTranslations(lang);

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      setErrorMsg(null);
      setSuccessReceipt(null);
      setReceiptId(null);
      setActiveTab('form');
      setTurnstileToken('');
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMsg(t('FriendsModalErrImageFormat'));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg(t('FriendsModalErrImageSize'));
      return;
    }
    setErrorMsg(null);
    setScreenshot(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const removeScreenshot = () => {
    setScreenshot(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const getLocalizedError = (raw: string) => {
    if (/已收录/.test(raw)) return t('FriendsModalErrDuplicateUrl');
    if (/人机|验证码/.test(raw)) return t('FriendsModalErrVerifyFailed');
    if (/频繁|限流/.test(raw)) return t('FriendsModalErrRateLimit');
    if (/HTTPS|网址|链接/.test(raw)) return t('FriendsModalErrHttps');
    if (/介绍|描述|字以内|200/.test(raw)) return t('FriendsModalErrDesc');
    if (/邮箱/.test(raw)) return t('FriendsModalErrEmail');
    if (/格式|PNG|JPEG|WebP/.test(raw)) return t('FriendsModalErrImageFormat');
    if (/体积|2MB|过大/.test(raw)) return t('FriendsModalErrImageSize');
    return raw || t('FriendsModalErrFailed');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!turnstileToken) {
      setErrorMsg(t('FriendsModalErrVerify'));
      return;
    }
    if (!url.startsWith('https://')) {
      setErrorMsg(t('FriendsModalErrHttps'));
      setActiveTab('form');
      return;
    }
    if (!description.trim() || description.length > 200) {
      setErrorMsg(t('FriendsModalErrDesc'));
      setActiveTab('form');
      return;
    }
    if (!email.includes('@')) {
      setErrorMsg(t('FriendsModalErrEmail'));
      setActiveTab('form');
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      if (name.trim()) fd.append('name', name.trim());
      fd.append('url', url.trim());
      fd.append('description', description.trim());
      fd.append('email', email.trim());
      fd.append('turnstileToken', turnstileToken);
      if (screenshot) fd.append('screenshot', screenshot);

      const res = await fetch('/api/v1/friend-link-applications', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: fd,
      });
      const data = (await res.json()) as {
        success?: boolean;
        error?: { message?: string; code?: string };
        data?: { id?: string; message?: string };
      };
      if (!res.ok || !data.success) {
        const raw = data.error?.message || t('FriendsModalErrFailed');
        throw new Error(getLocalizedError(raw));
      }
      setReceiptId(data.data?.id || null);
      setSuccessReceipt(t('FriendsModalSuccessDefault'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('FriendsModalErrNetwork');
      setErrorMsg(getLocalizedError(msg));
      setTurnstileToken('');
      setTurnstileResetKey((v) => v + 1);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* 遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity"
        />

        {/* 弹窗卡片 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className="relative w-full max-w-xl rounded-2xl bg-card border border-border/80 shadow-2xl p-6 sm:p-7 z-10 my-8 text-foreground overflow-hidden"
        >
          {/* 顶部品牌金色渐变装饰线 */}
          <div
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#d4a958]/70 to-transparent"
            aria-hidden="true"
          />

          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a958]/50"
            aria-label={t('FriendsModalCloseAria')}
          >
            <Icon icon="ph:x-bold" width={16} height={16} />
          </button>

          {successReceipt ? (
            <div className="py-8 text-center space-y-4">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', damping: 15 }}
                className="size-16 rounded-full bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/25 text-emerald-500 dark:text-emerald-400 mx-auto flex items-center justify-center shadow-xs"
              >
                <Icon icon="ph:check-circle-duotone" width={38} height={38} />
              </motion.div>

              <div className="space-y-1.5">
                <h3 className="text-xl font-bold text-foreground tracking-tight">
                  {t('FriendsModalSuccessTitle')}
                </h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                  {successReceipt}
                </p>
              </div>

              {receiptId && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted/60 border border-border/60 text-xs font-mono text-muted-foreground select-all">
                  <Icon icon="ph:hash-bold" width={12} height={12} className="text-[#d4a958]" />
                  <span>
                    {t('FriendsModalReceiptLabel')}: {receiptId}
                  </span>
                </div>
              )}

              <p className="text-xs text-muted-foreground/80 leading-relaxed max-w-xs mx-auto">
                {t('FriendsModalReceiptNotice')}
              </p>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-7 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] shadow-sm hover:shadow-[0_0_24px_rgba(212,169,88,0.35)] hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a958]/50"
                >
                  {t('FriendsModalDoneBtn')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* 标题 + 标签切换 */}
              <div className="flex items-center justify-between mb-5 pr-8">
                <div>
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Icon
                      icon="ph:link-duotone"
                      width={20}
                      height={20}
                      className="text-[#d4a958]"
                    />
                    <span>{t('FriendsModalTitle')}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('FriendsModalSubtitle')}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border/60 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className={cn(
                      'px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-medium',
                      activeTab === 'form'
                        ? 'bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <Icon icon="ph:note-pencil-duotone" width={13} height={13} />
                    <span>{t('FriendsModalTabForm')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={cn(
                      'px-3 py-1 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer font-medium',
                      activeTab === 'preview'
                        ? 'bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    <Icon icon="ph:eye-duotone" width={13} height={13} />
                    <span>{t('FriendsModalTabPreview')}</span>
                  </button>
                </div>
              </div>

              {/* 错误提示 */}
              {errorMsg && (
                <div
                  role="alert"
                  className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/25 text-destructive dark:text-rose-400 text-xs leading-relaxed flex items-start gap-2.5 shadow-xs"
                >
                  <Icon
                    icon="ph:warning-circle-duotone"
                    width={16}
                    height={16}
                    className="shrink-0 mt-0.5 text-destructive dark:text-rose-400"
                  />
                  <span className="font-medium">{errorMsg}</span>
                </div>
              )}

              {/* 卡片预览 Tab */}
              {activeTab === 'preview' ? (
                <div className="py-4 space-y-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon
                      icon="ph:info-duotone"
                      width={14}
                      height={14}
                      className="text-[#d4a958]"
                    />
                    <span>{t('FriendsModalPreviewTip')}</span>
                  </div>
                  <div className="max-w-sm mx-auto">
                    <FriendCard
                      lang={lang}
                      name={name.trim()}
                      url={url.trim() || 'https://example.com'}
                      description={description.trim() || t('FriendsModalPreviewDescPlaceholder')}
                      screenshotUrl={previewUrl}
                      interactive={false}
                      className="shadow-md"
                    />
                  </div>
                  <div className="text-center pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveTab('form')}
                      className="text-xs text-[#d4a958] hover:text-[#b88c3e] hover:underline cursor-pointer inline-flex items-center gap-1 font-medium transition-colors"
                    >
                      <Icon icon="ph:arrow-left-bold" width={12} height={12} />
                      <span>{t('FriendsModalBackToForm')}</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* 申请表单 Tab */
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* 博客名称 */}
                  <div>
                    <label
                      htmlFor="m-name"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelName')}
                    </label>
                    <div className="relative">
                      <Icon
                        icon="ph:user-duotone"
                        width={15}
                        height={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                      />
                      <input
                        id="m-name"
                        type="text"
                        maxLength={50}
                        placeholder={t('FriendsModalNamePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#d4a958] focus:ring-1 focus:ring-[#d4a958]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* 网站链接 */}
                  <div>
                    <label
                      htmlFor="m-url"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelUrl')}
                    </label>
                    <div className="relative">
                      <Icon
                        icon="ph:globe-duotone"
                        width={15}
                        height={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                      />
                      <input
                        id="m-url"
                        type="url"
                        required
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-muted/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#d4a958] focus:ring-1 focus:ring-[#d4a958]/30 transition-all"
                      />
                      {url.startsWith('https://') && (
                        <Icon
                          icon="ph:check-circle-fill"
                          width={15}
                          height={15}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* 网站描述 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="m-desc"
                        className="block text-xs font-medium text-muted-foreground"
                      >
                        {t('FriendsModalLabelDesc')}
                      </label>
                      <span
                        className={cn(
                          'text-[10px] font-mono tabular-nums transition-colors',
                          description.length > 180
                            ? 'text-amber-500 font-semibold'
                            : 'text-muted-foreground/50',
                        )}
                      >
                        {description.length}/200
                      </span>
                    </div>
                    <div className="relative">
                      <Icon
                        icon="ph:text-align-left-duotone"
                        width={15}
                        height={15}
                        className="absolute left-3.5 top-2.5 text-muted-foreground/60"
                      />
                      <textarea
                        id="m-desc"
                        required
                        rows={2}
                        maxLength={200}
                        placeholder={t('FriendsModalDescPlaceholder')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#d4a958] focus:ring-1 focus:ring-[#d4a958]/30 transition-all resize-none"
                      />
                    </div>
                  </div>

                  {/* 邮箱 */}
                  <div>
                    <label
                      htmlFor="m-email"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelEmail')}
                    </label>
                    <div className="relative">
                      <Icon
                        icon="ph:envelope-duotone"
                        width={15}
                        height={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/60"
                      />
                      <input
                        id="m-email"
                        type="email"
                        required
                        placeholder="yourname@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border/70 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#d4a958] focus:ring-1 focus:ring-[#d4a958]/30 transition-all"
                      />
                    </div>
                  </div>

                  {/* 截图上传 */}
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-1">
                      {t('FriendsModalLabelScreenshot')}
                    </span>
                    {previewUrl ? (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-border/70 group shadow-xs">
                        <img
                          src={previewUrl}
                          alt="Screenshot Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 text-white/80 hover:text-white hover:bg-black/90 transition-all cursor-pointer shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
                          aria-label={t('FriendsModalRemoveScreenshotAria')}
                        >
                          <Icon icon="ph:x-bold" width={12} height={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border border-dashed border-border/80 hover:border-[#d4a958]/50 bg-muted/20 hover:bg-muted/40 transition-all cursor-pointer group">
                        <div className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground text-xs transition-colors">
                          <Icon
                            icon="ph:image-duotone"
                            width={18}
                            height={18}
                            className="text-[#d4a958]"
                          />
                          <span>{t('FriendsModalUploadHint')}</span>
                        </div>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>

                  {/* Turnstile 人机验证 */}
                  <div>
                    {turnstileSiteKey ? (
                      <TurnstileWidget
                        siteKey={turnstileSiteKey}
                        onToken={setTurnstileToken}
                        resetKey={turnstileResetKey}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t('FriendsModalVerifyUnavailable')}
                      </p>
                    )}
                  </div>

                  {/* 提交按钮 */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !turnstileToken}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] shadow-sm hover:shadow-[0_0_24px_rgba(212,169,88,0.3)] hover:brightness-105 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d4a958]/50"
                    >
                      {loading ? (
                        <>
                          <Icon
                            icon="ph:spinner-gap-bold"
                            width={15}
                            height={15}
                            className="animate-spin"
                          />
                          <span>{t('FriendsModalSubmitting')}</span>
                        </>
                      ) : (
                        <>
                          <Icon icon="ph:paper-plane-tilt-fill" width={15} height={15} />
                          <span>{t('FriendsModalSubmitBtn')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
