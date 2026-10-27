import { CODEX, MOBIUS_BAND, ORBITAL_RINGS, type ShapeConfig } from './plexus-shapes';

interface HeroPatternAdapter {
  id: string;
  label: { en: string; zh: string };
  entries: readonly { shape: ShapeConfig; holdMs: number }[];
  connectionDistance?: (particleCount: number) => number;
}

/** Each pattern supplies particle targets to the shared WebGL scene. */
export const HERO_PATTERN_ADAPTERS = [
  { id: 'codex', label: { en: 'Classic', zh: '经典' }, entries: CODEX },
  {
    id: 'orbits',
    label: { en: 'Orbits', zh: '轨道' },
    entries: [{ shape: ORBITAL_RINGS, holdMs: 10_000 }],
  },
  {
    id: 'mobius',
    label: { en: 'Möbius', zh: '莫比乌斯' },
    entries: [{ shape: MOBIUS_BAND, holdMs: 10_000 }],
    connectionDistance: (count: number) => (count < 400 ? 0.8 : 0.5),
  },
] as const satisfies readonly HeroPatternAdapter[];

export type HeroPatternId = (typeof HERO_PATTERN_ADAPTERS)[number]['id'];
export type ParticlePattern = HeroPatternAdapter & { id: HeroPatternId };

export function getHeroPatternAdapter(id: HeroPatternId): ParticlePattern {
  return HERO_PATTERN_ADAPTERS.find((adapter) => adapter.id === id) ?? HERO_PATTERN_ADAPTERS[0];
}
