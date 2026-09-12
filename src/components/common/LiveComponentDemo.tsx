'use client';

import { Floating3DParticles } from '@/registry/magicui/floating-3d-particles';

interface LiveComponentDemoProps {
  componentSlug: string;
}

const registry: Record<string, React.ReactNode> = {
  'floating-3d-particles': (
    <div
      className="relative w-full overflow-hidden rounded-xl bg-black"
      style={{ height: '420px' }}
    >
      <Floating3DParticles quantity={350} color="#8B5CF6" depth={0.55} drift={0.75} />
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 select-none">
        <span className="font-mono text-xs tracking-widest text-white/20 uppercase">
          floating-3d-particles
        </span>
        <span className="text-xl font-semibold text-white/50">
          Canvas 2D · zero dependencies · 6 props
        </span>
      </div>
    </div>
  ),
};

export default function LiveComponentDemo({ componentSlug }: LiveComponentDemoProps) {
  const node = registry[componentSlug];
  if (!node) return null;
  return (
    <section className="container mx-auto px-4 pb-4">
      <h2 className="mb-4 text-2xl font-bold">Floating 3D Particles Demo</h2>
      {node}
    </section>
  );
}
