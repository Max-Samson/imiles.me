'use client';

import { ArrowLeft } from 'lucide-react';
import { LiquidGlassButton } from '@/components/ui/liquid-glass-button';
import { cn } from '@/lib/utils';

export interface BackButtonProps {
  href: string;
  label: string;
  className?: string;
}

export default function BackButton({ href, label, className }: BackButtonProps) {
  return (
    <div className={cn('mb-5', className)}>
      <LiquidGlassButton
        href={href}
        variant="rainbow"
        size="xs"
        glow
        shimmer
        icon={<ArrowLeft className="size-3.5" />}
        aria-label={`Back to ${label}`}
      >
        {label}
      </LiquidGlassButton>
    </div>
  );
}
