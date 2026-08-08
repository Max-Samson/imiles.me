'use client';
import type { ReactNode } from 'react';

/** 时间线子区块:一个标签 + 一段内容(可渲染任意 React 节点) */
interface Subsection {
  label: string;
  content: () => ReactNode;
}

/** 时间线条目:一个年份/阶段,可包含多个子区块 */
interface TimelineEntryData {
  title: string;
  compact?: boolean;
  subsections?: Subsection[];
}

/**
 * 个人时间线数据(About 页 WelcomeTimeline 组件使用,当前为空)。
 *
 * 添加方法:按 TimelineEntryData 结构新增条目,例如:
 * {
 *   title: '2026',
 *   subsections: [
 *     { label: '里程碑', content: () => <p>这一年发生的事…</p> },
 *   ],
 * }
 *
 * 注意:content 里用图片时请使用 TimelineImage 组件,
 * 并在 src/data/imageCredits.ts 中同步登记第三方图片版权。
 */
export const welcomeTimelineData: TimelineEntryData[] = [];
