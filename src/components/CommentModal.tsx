'use client';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { useTranslations } from '@/lib/i18n';
export default function CommentModal() {
  const { t } = useTranslations();
  const maxLength = 200;
  const [commentText, setCommentText] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false); // 模拟登录状态
  const handleCommentTextChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ) => {
    setCommentText(e.target.value);
  };
  return (
    <div className="relative p-4 rounded-lg border border-gray-200">
      {/* 评论输入框 */}
      <div className="relative">
        <textarea
          name="comment"
          id="comment"
          placeholder={t('CommitPlaceholder')}
          className={cn(
            'w-full p-4 border border-gray-300 rounded-md h-40 resize-none',
            'focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-yellow-100/50 focus:border-transparent',
            'text-gray-700 placeholder:text-gray-400',
          )}
          maxLength={maxLength}
          value={commentText}
          onChange={handleCommentTextChange}
        />
        {/* 字数统计 */}
        <div className="absolute right-4 bottom-4 text-xs text-gray-400">
          {commentText.length}/{maxLength}
        </div>
      </div>

      {/* 登录提示 + 提交按钮 */}
      <div className="mt-4 flex items-center justify-between">
        {/* {!isLoggedIn && (
          <div className="flex items-center text-orange-500 text-sm">
            <svg
              className="w-4 h-4 mr-1"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span>请登录后继续</span>
          </div>
        )} */}

        <button
          disabled={!isLoggedIn || commentText.trim().length === 0}
          className={cn(
            'px-6 py-2 rounded-md text-white font-medium transition-all duration-200',
            isLoggedIn && commentText.trim().length > 0
              ? 'rgb(106 137 186) rgb(92 139 241) dark:bg-yellow-100/50 dark:hover:bg-yellow-200/80 shadow-md hover:shadow-lg'
              : 'bg-blue-300 dark:bg-yellow-100/50 cursor-not-allowed',
          )}
        >
          {t('Submit')}
        </button>
      </div>
    </div>
  );
}
