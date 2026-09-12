'use client';

import { addCollection, Icon } from '@iconify/react';
import { X } from 'lucide-react';
import { createElement, useEffect, useState } from 'react';
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

  // Attach a click handler + affordance to the section heading.
  useEffect(() => {
    if (!headingId || inline) return;
    const heading = document.getElementById(headingId);
    if (!heading) return;

    heading.classList.add('cursor-pointer', 'group');

    const hint = document.createElement('button');
    hint.type = 'button';
    hint.className =
      'ml-2 inline-flex translate-y-[-2px] items-center gap-1 align-middle text-sm font-normal text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground';
    hint.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>';
    hint.setAttribute('aria-label', 'View the full tech stack as an icon cloud');
    hint.addEventListener('click', (event) => {
      event.stopPropagation();
      setOpen(true);
    });
    heading.appendChild(hint);

    const onClick = (event: MouseEvent) => {
      // Ignore clicks on the heading anchor-link button added by HeadingLinkEnhancer.
      if ((event.target as HTMLElement).closest('button')) return;
      setOpen(true);
    };
    heading.addEventListener('click', onClick);

    return () => {
      heading.removeEventListener('click', onClick);
      heading.classList.remove('cursor-pointer', 'group');
      hint.remove();
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Tech stack icon cloud"
    >
      <button
        type="button"
        aria-label="Close tech stack icon cloud"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default"
      />
      <div className="relative">
        <IconCloud icons={CLOUD_ICONS} />
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-label="Close tech stack icon cloud"
        className="absolute right-6 top-6 rounded-full border border-border bg-background/80 p-2 text-muted-foreground transition-colors hover:text-foreground"
      >
        <X size={20} />
      </button>
      <p className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground">
        Drag to rotate · Esc to close
      </p>
    </div>
  );
}
