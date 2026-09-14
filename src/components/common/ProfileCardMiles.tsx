'use client';

import { useCallback, useState } from 'react';
import { author } from '@/data/author';
import type { Locale } from '@/lib/i18n';
import BaseProfileCard from '@/registry/react-bits/ProfileCard';

export interface ProfileCardMilesProps {
  /** 显示姓名，默认使用作者名 */
  name?: string;
  /** 头衔 / 职位，支持根据语言自动本地化 */
  title?: string;
  /** 用户名 Handle，如 imiles */
  handle?: string;
  /** 在线 / 合作状态文本 */
  status?: string;
  /** 联系按钮文本 */
  contactText?: string;
  /** 头像路径，默认 public/images/avatar.png */
  avatarUrl?: string;
  /** 缩小版头像路径（可选，不传回退为 avatarUrl） */
  miniAvatarUrl?: string;
  /** 是否显示底部用户信息栏 */
  showUserInfo?: boolean;
  /** 是否开启 3D 鼠标悬停阻尼倾斜 */
  enableTilt?: boolean;
  /** 是否开启移动端陀螺仪倾斜 */
  enableMobileTilt?: boolean;
  /** 移动端倾斜灵敏度 */
  mobileTiltSensitivity?: number;
  /** 背后光晕颜色，默认明亮杏金色 */
  behindGlowColor?: string;
  /** 背后光晕尺寸 */
  behindGlowSize?: string;
  /** 是否开启背后光晕 */
  behindGlowEnabled?: boolean;
  /** 背景全息图案图标 */
  iconUrl?: string;
  /** 纹理杂色图案 */
  grainUrl?: string;
  /** 卡片内部渐变，默认暖陶色过渡到蜜桃与香槟金 */
  innerGradient?: string;
  /** 当前语言环境（用于自动本地化头衔、状态与反馈文本） */
  lang?: Locale;
  /** 自定义联系按钮点击回调（默认执行复制邮箱操作） */
  onContactClick?: () => void;
  /** 自定义类名 */
  className?: string;
}

export default function ProfileCardMiles({
  name = author.name,
  title,
  handle = 'Miles',
  status,
  contactText,
  avatarUrl = '/images/avatar.png',
  miniAvatarUrl,
  showUserInfo = true,
  enableTilt = true,
  enableMobileTilt = true,
  mobileTiltSensitivity = 5,
  behindGlowColor = 'rgba(255, 196, 125, 0.72)',
  behindGlowSize = '50%',
  behindGlowEnabled = true,
  iconUrl = '/assets/demo/iconpattern.png',
  grainUrl,
  innerGradient = 'linear-gradient(145deg, #b8775599 0%, #e9ac7373 55%, #ffe0a85c 100%)',
  lang = 'en',
  onContactClick,
  className = '',
}: ProfileCardMilesProps) {
  const isZh = lang === 'zh';
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 默认文本根据语言自适应
  const resolvedTitle = title ?? (isZh ? 'Web 全栈工程师' : 'Full-Stack Web Engineer');
  const resolvedStatus = status ?? (isZh ? '欢迎合作' : 'Open to Collaborate');
  const resolvedContactText = contactText ?? (isZh ? '联系我' : 'Contact Me');

  const handleContactClick = useCallback(() => {
    onContactClick?.();

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(author.email).catch(() => {});
    }

    const message = isZh ? `已复制邮箱：${author.email}` : `Email copied: ${author.email}`;
    setToastMessage(message);

    const timer = window.setTimeout(() => {
      setToastMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [isZh, onContactClick]);
  return (
    <div
      className={`relative flex flex-col items-center justify-center ${className}`.trim()}
      onPointerEnter={(e) => {
        const wrap = e.currentTarget.querySelector<HTMLElement>('[style*="perspective"]');
        wrap?.style.setProperty('--card-opacity', '1');
      }}
      onPointerLeave={(e) => {
        const wrap = e.currentTarget.querySelector<HTMLElement>('[style*="perspective"]');
        wrap?.style.setProperty('--card-opacity', '0');
      }}
    >
      <BaseProfileCard
        className={className}
        name={name}
        title={resolvedTitle}
        handle={handle}
        status={resolvedStatus}
        contactText={resolvedContactText}
        avatarUrl={avatarUrl}
        miniAvatarUrl={miniAvatarUrl}
        showUserInfo={showUserInfo}
        enableTilt={enableTilt}
        enableMobileTilt={enableMobileTilt}
        mobileTiltSensitivity={mobileTiltSensitivity}
        behindGlowColor={behindGlowColor}
        behindGlowSize={behindGlowSize}
        behindGlowEnabled={behindGlowEnabled}
        iconUrl={iconUrl}
        grainUrl={grainUrl}
        innerGradient={innerGradient}
        onContactClick={handleContactClick}
      />
      {/* 交互反馈浮层 Toast */}
      {toastMessage && (
        <output className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] flex items-center gap-2 rounded-full border border-white/20 bg-black/90 px-4 py-2 text-xs font-medium text-white shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span>{toastMessage}</span>
        </output>
      )}
    </div>
  );
}
