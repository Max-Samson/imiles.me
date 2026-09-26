'use client';

import { Icon } from '@iconify/react';
import { Loader2, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { type Locale, useTranslations } from '@/lib/i18n';
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
  const [idempotencyKey, setIdempotencyKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);

  useEffect(() => {
    if (open) {
      setIdempotencyKey(crypto.randomUUID());
      setErrorMsg(null);
      setSuccessReceipt(null);
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
        error?: { message?: string };
        data?: { message?: string };
      };
      if (!res.ok || !data.success)
        throw new Error(data.error?.message || t('FriendsModalErrFailed'));
      setSuccessReceipt(data.data?.message || t('FriendsModalSuccessDefault'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('FriendsModalErrNetwork'));
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
          className="fixed inset-0 bg-black/70 backdrop-blur-md"
        />

        {/* 弹窗 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="relative w-full max-w-xl rounded-2xl bg-card border border-border/80 dark:bg-[#1e1e21] dark:border-white/8 shadow-2xl p-6 sm:p-7 z-10 my-8 text-foreground"
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 dark:hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {successReceipt ? (
            <div className="py-10 text-center space-y-4">
              <div className="size-14 rounded-full bg-emerald-500/15 text-emerald-500 mx-auto flex items-center justify-center">
                <Icon icon="ph:check-circle-duotone" width={32} height={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t('FriendsModalSuccessTitle')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {successReceipt}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] transition-colors cursor-pointer"
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

                <div className="flex items-center gap-0.5 bg-muted/50 dark:bg-[#17171a] p-0.5 rounded-lg border border-border/50 dark:border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                      activeTab === 'form'
                        ? 'bg-[#d4a958] text-[#121214] font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t('FriendsModalTabForm')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('preview')}
                    className={`px-3 py-1 rounded-md flex items-center gap-1 transition-colors cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-[#d4a958] text-[#121214] font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Icon icon="ph:eye-duotone" width={12} height={12} />
                    <span>{t('FriendsModalTabPreview')}</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-red-500/8 border border-red-500/15 text-red-500 text-xs leading-relaxed flex items-start gap-2">
                  <Icon
                    icon="ph:warning-circle-duotone"
                    width={15}
                    height={15}
                    className="shrink-0 mt-0.5"
                  />
                  <span>{errorMsg}</span>
                </div>
              )}

              {activeTab === 'preview' ? (
                <div className="py-4 space-y-4">
                  <p className="text-xs text-muted-foreground">{t('FriendsModalPreviewTip')}</p>
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
                      className="text-xs text-[#d4a958] hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Icon icon="ph:arrow-left" width={12} height={12} />
                      {t('FriendsModalBackToForm')}
                    </button>
                  </div>
                </div>
              ) : (
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
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/30 border border-border/60 dark:bg-[#17171a] dark:border-white/8 text-xs text-foreground focus:outline-none focus:border-amber-500/60 dark:focus:border-[#d4a958]/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* URL */}
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
                        className="w-full pl-9 pr-8 py-2 rounded-xl bg-muted/30 border border-border/60 dark:bg-[#17171a] dark:border-white/8 text-xs text-foreground focus:outline-none focus:border-amber-500/60 dark:focus:border-[#d4a958]/50 transition-colors"
                      />
                      {url.startsWith('https://') && (
                        <Icon
                          icon="ph:check-bold"
                          width={14}
                          height={14}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                        />
                      )}
                    </div>
                  </div>

                  {/* 描述 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="m-desc"
                        className="block text-xs font-medium text-muted-foreground"
                      >
                        {t('FriendsModalLabelDesc')}
                      </label>
                      <span
                        className={`text-[10px] font-mono tabular-nums ${description.length > 180 ? 'text-amber-500' : 'text-muted-foreground/40'}`}
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
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/30 border border-border/60 dark:bg-[#17171a] dark:border-white/8 text-xs text-foreground focus:outline-none focus:border-amber-500/60 dark:focus:border-[#d4a958]/50 transition-colors resize-none"
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
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/30 border border-border/60 dark:bg-[#17171a] dark:border-white/8 text-xs text-foreground focus:outline-none focus:border-amber-500/60 dark:focus:border-[#d4a958]/50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* 截图 */}
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-1">
                      {t('FriendsModalLabelScreenshot')}
                    </span>
                    {previewUrl ? (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-border/60 dark:border-white/8 group">
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={removeScreenshot}
                          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white/80 hover:text-white transition-colors cursor-pointer"
                          aria-label="Remove"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border border-dashed border-border/60 dark:border-white/10 hover:border-amber-500/30 dark:hover:border-[#d4a958]/30 bg-muted/20 hover:bg-muted/40 dark:bg-[#17171a]/30 dark:hover:bg-[#17171a]/60 transition-all cursor-pointer">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <Icon icon="ph:image-duotone" width={16} height={16} />
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

                  {/* Turnstile */}
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

                  {/* 提交 */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={loading || !turnstileToken}
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] hover:shadow-[0_0_20px_rgba(212,169,88,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={14} className="animate-spin" />
                          <span>{t('FriendsModalSubmitting')}</span>
                        </>
                      ) : (
                        <>
                          <Icon icon="ph:paper-plane-tilt-fill" width={14} height={14} />
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
