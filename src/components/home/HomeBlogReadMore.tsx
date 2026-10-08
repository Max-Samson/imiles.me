'use client';

import { ArrowRight } from 'lucide-react';
import { LiquidGlassButton, type LiquidGlassVariants } from '@/components/ui/liquid-glass-button';

export interface HomeBlogReadMoreProps {
  label?: string;
  variant?: LiquidGlassVariants['variant'];
  size?: 'sm' | 'default' | 'icon-sm';
  className?: string;
  'aria-hidden'?: boolean | 'true' | 'false';
}

export default function HomeBlogReadMore({
  label,
  variant = 'adaptive',
  size = 'sm',
  className,
  'aria-hidden': ariaHidden,
}: HomeBlogReadMoreProps) {
  const iconSize = size === 'default' ? 'size-4' : 'size-3.5';

  return (
    <LiquidGlassButton
      as="span"
      variant={variant}
      size={size}
      shape="squircle"
      interactive={false}
      curvedBevel={false}
      hapticScale={false}
      iconRight={<ArrowRight className={iconSize} />}
      className={className}
      aria-hidden={ariaHidden}
    >
      {label || undefined}
    </LiquidGlassButton>
  );
}
