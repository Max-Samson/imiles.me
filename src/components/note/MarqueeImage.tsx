'use client';

import { cn } from '@/lib/utils';
import { Marquee } from '@/registry/magicui/marquee';

interface MarqueeImageItem {
  src: string;
  alt: string;
  caption?: string;
}

interface MarqueeImageProps {
  images: MarqueeImageItem[];
}

export default function MarqueeImage({ images }: MarqueeImageProps) {
  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="mb-8 text-2xl font-bold">Demo</h2>

      <div className="relative flex w-full flex-col items-center justify-center overflow-hidden">
        <Marquee pauseOnHover className="[--duration:8s]">
          {images.map((img) => (
            <figure
              key={img.src}
              className={cn(
                'relative w-64 cursor-pointer overflow-hidden rounded-xl border p-4',
                // light styles
                'border-gray-950/[.1] bg-gray-950/[.01] hover:bg-gray-950/[.05]',
                // dark styles
                'dark:border-gray-50/[.1] dark:bg-gray-50/[.10] dark:hover:bg-gray-50/[.15]',
              )}
            >
              <img
                src={img.src}
                alt={img.alt}
                className="w-full rounded-lg object-cover"
                loading="lazy"
              />
              <div className="text-sm font-medium dark:text-white">
                {img.alt}
              </div>
              <div className="text-xs font-medium dark:text-white/40">
                {img.caption}
              </div>
            </figure>
          ))}
        </Marquee>
        {/* 首尾蒙层 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/4 bg-gradient-to-r from-white dark:from-background"></div>
        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/4 bg-gradient-to-l from-white dark:from-background"></div>
      </div>
    </section>
  );
}
