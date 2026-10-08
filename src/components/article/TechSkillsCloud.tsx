'use client';

import { addCollection, Icon } from '@iconify/react';
import { Cloud, X } from 'lucide-react';
import { createElement, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import javaIcon from '@/data/java-icon.json';
import techIcons from '@/data/tech-icons.json';
import { IconCloud } from '@/registry/magicui/icon-cloud';

// Register the bundled icon subsets (simple-icons + devicon for the Java logo) so
// the cloud renders offline. Icons missing from Iconify are intentionally not shown.
addCollection(techIcons);
addCollection(javaIcon);

const STACK: { name: string; slug?: string; icon?: string }[] = [
  { name: 'Vue 3', slug: 'vuedotjs' },
  { name: 'React', slug: 'react' },
  { name: 'TypeScript', slug: 'typescript' },
  { name: 'Astro', slug: 'astro' },
  { name: 'Nuxt', slug: 'nuxt' },
  { name: 'Tailwind CSS', slug: 'tailwindcss' },
  { name: 'UnoCSS', slug: 'unocss' },
  { name: 'Figma', slug: 'figma' },
  { name: 'Node.js', slug: 'nodedotjs' },
  { name: 'Go', slug: 'go' },
  { name: 'Java', icon: 'devicon:java' },
  { name: 'Cloudflare Workers', slug: 'cloudflare' },
  { name: 'D1 / SQLite', slug: 'sqlite' },
  { name: 'Drizzle ORM', slug: 'drizzle' },
  { name: 'Prisma', slug: 'prisma' },
  { name: 'LLM APIs', slug: 'openai' },
  { name: 'Cloudflare Queue', slug: 'cloudflare' },
  { name: 'Stripe Checkout', slug: 'stripe' },
  { name: 'Google OAuth', slug: 'google' },
  { name: 'i18n (11 languages)', slug: 'googletranslate' },
  { name: 'Git', slug: 'git' },
  { name: 'Vite', slug: 'vite' },
  { name: 'Webpack', slug: 'webpack' },
  { name: 'Wails', slug: 'wails' },
  { name: 'Docker', slug: 'docker' },
  { name: 'MDX', slug: 'mdx' },
  { name: 'Markdown', slug: 'markdown' },
];

const CLOUD_ICONS = STACK.map((item) => {
  const icon = item.icon ?? `simple-icons:${item.slug}`;
  const color = item.slug ? (techIcons.colors as Record<string, string>)[item.slug] : undefined;
  return createElement(Icon, {
    icon,
    width: 100,
    height: 100,
    // Brand color per icon; devicon icons carry embedded fills and need no color.
    ...(color ? { color } : {}),
    // IconCloud serializes icons with renderToString, so icon data must be
    // resolved during render (ssr: true) instead of waiting for useEffect.
    ssr: true,
    key: item.name,
  });
});

interface TechSkillsCloudProps {
  /** rehype-slug id of the "Technical Skills" heading to attach the click handler to */
  headingId?: string;
  inline?: boolean;
}

export default function TechSkillsCloud({ headingId, inline = false }: TechSkillsCloudProps) {
  const [open, setOpen] = useState(false);
  const [headingEl, setHeadingEl] = useState<HTMLElement | null>(null);

  // Attach a click handler + affordance to the section heading.
  useEffect(() => {
    if (!headingId || inline) return;

    let cleanupHeading: (() => void) | undefined;

    const attachToHeading = () => {
      const heading = document.getElementById(headingId);
      if (!heading) return false;

      heading.classList.add('cursor-pointer', 'group');
      setHeadingEl(heading);

      const onClick = (event: MouseEvent) => {
        // Ignore clicks on heading anchor-link button or our trigger button
        if ((event.target as HTMLElement).closest('button')) return;
        setOpen(true);
      };
      heading.addEventListener('click', onClick);

      cleanupHeading = () => {
        heading.removeEventListener('click', onClick);
        heading.classList.remove('cursor-pointer', 'group');
      };
      return true;
    };

    if (!attachToHeading()) {
      const timer = setTimeout(attachToHeading, 50);
      return () => {
        clearTimeout(timer);
        cleanupHeading?.();
      };
    }

    return () => {
      cleanupHeading?.();
    };
  }, [headingId, inline]);

  // Esc to close + scroll lock while open.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (inline) return <IconCloud icons={CLOUD_ICONS} />;

  const isZh =
    headingId === '技术能力' ||
    (typeof document !== 'undefined' &&
      (document.documentElement.lang === 'zh' || window.location.pathname.startsWith('/zh')));

  const triggerButton = (
    <LiquidGlassButton
      type="button"
      variant="adaptive"
      size="icon-sm"
      shape="squircle"
      glow
      shimmer
      icon={<Cloud className="size-4" />}
      onClick={(event) => {
        event.stopPropagation();
        setOpen(true);
      }}
      className="ml-2.5 inline-flex align-middle cursor-pointer select-none shadow-xs shrink-0"
      aria-label={isZh ? '打开 3D 动态技术栈图标球' : 'Open 3D Tech Stack Icon Cloud'}
      title={isZh ? '打开 3D 动态技术栈图标球' : 'Open 3D Tech Stack Icon Cloud'}
    />
  );

  return (
    <>
      {headingEl && createPortal(triggerButton, headingEl)}

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={isZh ? '3D 动态技术栈图标球' : 'Tech stack icon cloud'}
        >
          <button
            type="button"
            aria-label={isZh ? '关闭' : 'Close tech stack icon cloud'}
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default"
          />
          <div className="relative">
            <IconCloud icons={CLOUD_ICONS} />
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={isZh ? '关闭' : 'Close tech stack icon cloud'}
            className="absolute right-6 top-6 rounded-full border border-border bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
          >
            <X size={20} />
          </button>
          <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground">
            {isZh ? '拖拽旋转 · 按 Esc 退出' : 'Drag to rotate · Esc to close'}
          </p>
        </div>
      )}
    </>
  );
}
