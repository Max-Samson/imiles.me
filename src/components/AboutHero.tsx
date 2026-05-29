'use client';
import { useTranslations } from '@/lib/i18n';
import { AuroraText } from '@/registry/magicui/aurora-text';
import { AnimatedSpan, Terminal, TypingAnimation } from '@/registry/magicui/terminal';
import Phonetic from './Phonetic';
import SocialLinksGrid from './SocialLinksGrid';

export default function AboutHero() {
  const { t } = useTranslations();
  const intro = t('PageAboutDescription');
  const role =
    t('Headerabout') === '关于'
      ? '前端工程师，关注 AI、全栈产品、工程体验与长期写作。'
      : 'Frontend engineer focused on AI, full-stack products, developer experience, and long-form writing.';
  return (
    <main className="relative mx-auto max-w-3xl px-6 pt-24 pb-16">
      <div className="mb-5">
        <h1 className="text-4xl font-bold" style={{ fontFamily: 'Rock Salt, cursive' }}>
          <AuroraText>Miles</AuroraText>
        </h1>
        <Phonetic ipa={role} className="mt-1 block text-base md:text-lg" />
      </div>

      <div className="prose prose-neutral dark:prose-invert max-w-none">
        <p>{intro}</p>
        {/* <p>
          <strong>Urmzd</strong> derives from <em>Ahura Mazda</em> — the Avestan
          name meaning "Lord of Wisdom." It's a name rooted in Zoroastrian
          tradition, carried across Central Asia into Tajik and Persian cultures
          where my family originates.
        </p>

        <p>
          I'm a software engineer based in Austin, Texas. I build tools that
          turn structured thinking into working software — from developer
          utilities and machine learning pipelines to interactive web
          experiences like this site. When I'm not writing code, I'm likely on
          the mats training Brazilian Jiu-Jitsu or exploring a new city. For the
          full story, check out my <a href="/blog/welcome">welcome post</a>.
        </p> */}
        <div className="flex justify-center px-0 py-3 sm:p-3 bg-transparent">
          <Terminal className="w-full max-w-xl font-mono text-sm shadow-xl transition-all duration-300 border border-black/10 dark:border-white/10 bg-white dark:bg-black/90 min-h-[450px] sm:min-h-[480px]">
            {/* 1. 输入初始化命令 - 使用中性灰色适配 */}
            <TypingAnimation delay={200} className="text-slate-500 dark:text-gray-500">
              &gt; init --stack engineer.miles.ts
            </TypingAnimation>

            {/* 2. 定义核心技术栈对象 - 颜色明度双向适配 */}
            <AnimatedSpan className="text-slate-800 dark:text-white mt-2 block font-medium">
              <span className="text-purple-600 dark:text-purple-400">const</span>{' '}
              <span className="text-blue-600 dark:text-blue-400">techStack</span>:{' '}
              <span className="text-emerald-600 dark:text-green-400">EngineerProfile</span> = {'{'}
            </AnimatedSpan>

            {/* 前端核心 - 注释颜色微调 */}
            <AnimatedSpan className="text-slate-400 dark:text-gray-400 pl-6 block">
              {'// Core Frontend Ecosystem'}
            </AnimatedSpan>
            <AnimatedSpan className="text-slate-700 dark:text-white pl-6 block">
              frontend: [<span className="text-orange-600 dark:text-orange-400">'Vue3'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'React'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'TypeScript'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'Astro'</span>
              ],
            </AnimatedSpan>

            {/* UI & 样式 */}
            <AnimatedSpan className="text-slate-400 dark:text-gray-400 pl-6 block mt-1">
              {'// UI / DX'}
            </AnimatedSpan>
            <AnimatedSpan className="text-slate-700 dark:text-white pl-6 block">
              styling: [<span className="text-orange-600 dark:text-orange-400">'TailwindCSS'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'UnoCSS'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'Figma'</span>
              ],
            </AnimatedSpan>

            {/* 跨平台 & 后端 */}
            <AnimatedSpan className="text-slate-400 dark:text-gray-400 pl-6 block mt-1">
              {'// Cross-Platform & Backend (Plus)'}
            </AnimatedSpan>
            <AnimatedSpan className="text-slate-700 dark:text-white pl-6 block">
              plus: [<span className="text-orange-600 dark:text-orange-400">'Go'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'Wails'</span>,{' '}
              <span className="text-orange-600 dark:text-orange-400">'Java'</span>
              ],
            </AnimatedSpan>

            {/* 状态 */}
            <AnimatedSpan className="text-slate-700 dark:text-white pl-6 block mt-2 font-semibold">
              status:{' '}
              <span className="text-orange-600 dark:text-orange-400">'Open to Collaborate'</span>,
            </AnimatedSpan>

            {/* 结尾括号 */}
            <AnimatedSpan className="text-slate-800 dark:text-white block">{'};'}</AnimatedSpan>

            {/* 3. 模拟编译成功 - 强化亮色模式下的可读性 */}
            <div className="flex items-center gap-2 mt-3">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <AnimatedSpan className="text-emerald-600 dark:text-green-500 font-bold block">
                ✔ Type-check complete. Profile exported.
              </AnimatedSpan>
            </div>

            <TypingAnimation delay={3000} className="text-slate-400 dark:text-gray-500 block">
              &gt; _
            </TypingAnimation>
          </Terminal>
        </div>
        <h2>{t('ContactTitle')}</h2>
        <SocialLinksGrid />
      </div>
    </main>
  );
}
