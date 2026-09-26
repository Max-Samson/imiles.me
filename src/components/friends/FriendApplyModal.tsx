'use client';

import {
  Check,
  CheckCircle2,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Loader2,
  Mail,
  ShieldCheck,
  Upload,
  User,
  X,
} from 'lucide-react';
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

  // 表单受控状态
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [email, setEmail] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');

  // 提交状态机
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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // 文件选择与体积格式校验
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

  // 提交表单
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
      const formData = new FormData();
      if (name.trim()) {
        formData.append('name', name.trim());
      }
      formData.append('url', url.trim());
      formData.append('description', description.trim());
      formData.append('email', email.trim());
      formData.append('turnstileToken', turnstileToken);
      if (screenshot) {
        formData.append('screenshot', screenshot);
      }
      const res = await fetch('/api/v1/friend-link-applications', {
        method: 'POST',
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
        body: formData,
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
        data?: { message?: string };
      };

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || t('FriendsModalErrFailed'));
      }

      setSuccessReceipt(data.data?.message || t('FriendsModalSuccessDefault'));
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('FriendsModalErrNetwork'));
      setTurnstileToken('');
      setTurnstileResetKey((value) => value + 1);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* 背景毛玻璃遮罩 */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md"
        />

        {/* 弹窗主体卡片 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-xl rounded-2xl bg-card border border-border dark:bg-[#1e1e21] dark:border-white/10 shadow-2xl p-6 sm:p-7 z-10 my-8 text-foreground"
        >
          {/* 关闭按钮 */}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>

          {successReceipt ? (
            /* 提交成功回执卡片 */
            <div className="py-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full bg-[#10b981]/20 text-[#10b981] mx-auto flex items-center justify-center">
                <CheckCircle2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t('FriendsModalSuccessTitle')}</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                {successReceipt}
              </p>
              <div className="pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] font-semibold transition-colors cursor-pointer"
                >
                  {t('FriendsModalDoneBtn')}
                </button>
              </div>
            </div>
          ) : (
            <div>
              {/* 标题栏与移动端预览切换 */}
              <div className="flex items-center justify-between mb-5 pr-8">
                <div>
                  <h3 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                    <ShieldCheck size={20} className="text-[#d4a958]" />
                    <span>{t('FriendsModalTitle')}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t('FriendsModalSubtitle')}
                  </p>
                </div>

                {/* 模式切换 (填写 / 实时预览) */}
                <div className="flex items-center gap-1 bg-muted/60 dark:bg-[#17171a] p-1 rounded-xl border border-border dark:border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setActiveTab('form')}
                    className={`px-3 py-1 rounded-lg transition-colors cursor-pointer ${
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
                    className={`px-3 py-1 rounded-lg flex items-center gap-1 transition-colors cursor-pointer ${
                      activeTab === 'preview'
                        ? 'bg-[#d4a958] text-[#121214] font-bold'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Eye size={12} />
                    <span>{t('FriendsModalTabPreview')}</span>
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 rounded-xl bg-[#ef4444]/10 border border-[#ef4444]/20 text-[#ef4444] text-xs leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {activeTab === 'preview' ? (
                /* 实时卡片效果预览 */
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
                      className="text-xs text-[#d4a958] hover:underline cursor-pointer"
                    >
                      ← {t('FriendsModalBackToForm')}
                    </button>
                  </div>
                </div>
              ) : (
                /* 表单输入模式 */
                <form onSubmit={handleSubmit} className="space-y-3.5">
                  {/* 博客名称 / 站长称呼 */}
                  <div>
                    <label
                      htmlFor="modal-name"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelName')}
                    </label>
                    <div className="relative">
                      <User
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        id="modal-name"
                        type="text"
                        maxLength={50}
                        placeholder={t('FriendsModalNamePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border dark:bg-[#17171a] dark:border-white/10 text-xs text-foreground focus:outline-none focus:border-amber-500 dark:focus:border-[#d4a958] transition-colors"
                      />
                    </div>
                  </div>
                  {/* 网站 URL */}
                  <div>
                    <label
                      htmlFor="modal-url"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelUrl')}
                    </label>
                    <div className="relative">
                      <Globe
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        id="modal-url"
                        type="url"
                        required
                        placeholder="https://example.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border dark:bg-[#17171a] dark:border-white/10 text-xs text-foreground focus:outline-none focus:border-amber-500 dark:focus:border-[#d4a958] transition-colors"
                      />
                      {url.startsWith('https://') && (
                        <Check
                          size={14}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#10b981]"
                        />
                      )}
                    </div>
                  </div>

                  {/* 网站描述 */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="modal-desc"
                        className="block text-xs font-medium text-muted-foreground"
                      >
                        {t('FriendsModalLabelDesc')}
                      </label>
                      <span
                        className={`text-[11px] font-mono ${description.length > 180 ? 'text-[#d4a958]' : 'text-muted-foreground/60'}`}
                      >
                        {description.length}/200
                      </span>
                    </div>
                    <div className="relative">
                      <FileText
                        size={15}
                        className="absolute left-3.5 top-2.5 text-muted-foreground"
                      />
                      <textarea
                        id="modal-desc"
                        required
                        rows={2}
                        maxLength={200}
                        placeholder={t('FriendsModalDescPlaceholder')}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border dark:bg-[#17171a] dark:border-white/10 text-xs text-foreground focus:outline-none focus:border-amber-500 dark:focus:border-[#d4a958] transition-colors resize-none"
                      />
                    </div>
                  </div>

                  {/* 联系邮箱 */}
                  <div>
                    <label
                      htmlFor="modal-email"
                      className="block text-xs font-medium text-muted-foreground mb-1"
                    >
                      {t('FriendsModalLabelEmail')}
                    </label>
                    <div className="relative">
                      <Mail
                        size={15}
                        className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      />
                      <input
                        id="modal-email"
                        type="email"
                        required
                        placeholder="yourname@domain.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-muted/40 border border-border dark:bg-[#17171a] dark:border-white/10 text-xs text-foreground focus:outline-none focus:border-amber-500 dark:focus:border-[#d4a958] transition-colors"
                      />
                    </div>
                  </div>

                  {/* 站点截图上传（可选） */}
                  <div>
                    <span className="block text-xs font-medium text-muted-foreground mb-1">
                      {t('FriendsModalLabelScreenshot')}
                    </span>

                    {previewUrl ? (
                      <div className="relative w-full h-24 rounded-xl overflow-hidden border border-white/10 group">
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
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border border-dashed border-border dark:border-white/15 hover:border-amber-500/40 dark:hover:border-[#d4a958]/40 bg-muted/30 hover:bg-muted/60 dark:bg-[#17171a]/50 dark:hover:bg-[#17171a] transition-all cursor-pointer">
                        <div className="flex items-center gap-2 text-muted-foreground text-xs">
                          <ImagePlus size={16} />
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

                  {/* 验证码只在表单可见时加载；服务端仍会验证 token。 */}
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
                      className="w-full py-2.5 px-4 rounded-xl font-semibold text-xs bg-gradient-to-r from-[#d4a958] to-[#b88c3e] text-[#121214] hover:shadow-[0_0_20px_rgba(212,169,88,0.25)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                    >
                      {loading ? (
                        <>
                          <Loader2 size={15} className="animate-spin" />
                          <span>{t('FriendsModalSubmitting')}</span>
                        </>
                      ) : (
                        <>
                          <Upload size={15} />
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
