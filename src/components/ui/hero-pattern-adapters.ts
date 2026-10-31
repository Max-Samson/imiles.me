import {
  CODEX,
  CODEX_CN,
  type CodexEntry,
  MOBIUS_BAND,
  ORBITAL_RINGS,
  SIGNATURE_MING,
} from './plexus-shapes';

export type HeroPatternId = 'signature' | 'codex' | 'mobius' | 'orbits';

export interface HeroPatternAdapter {
  id: HeroPatternId;
  label: { en: string; zh: string };
  entries: readonly CodexEntry[];
  entriesZh?: readonly CodexEntry[];
  connectionDistance?: (particleCount: number) => number;
}

/**
 * 首页四大核心 3D 几何图案分组（一共四组）：
 * 1. 手书 · Ming（统一展示 Ming 英文手绘签名，中文手绘保留备用）
 * 2. 经典星图（历史原有的一整组：包含 8 组科学哲学图谱连续流动显示，不拆开）
 * 3. 莫比乌斯环（单面无尽拓扑曲面）
 * 4. 多重轨道（三重正交天体引力轨道）
 */
export const HERO_PATTERN_ADAPTERS: readonly HeroPatternAdapter[] = [
  {
    id: 'signature',
    label: { en: 'Signature', zh: '手书' },
    entries: [
      {
        name: { en: 'Signature · Ming', zh: '手书 · Ming' },
        shape: SIGNATURE_MING,
        quote: '\u201CCODE IS POETRY IN MOTION, LOGIC MEETS AESTHETICS.\u201D',
        author: 'SHENSHUAI MING',
        holdMs: 20_000,
        connectionDistance: (count: number) => (count < 400 ? 0.95 : 0.45),
      },
    ],
    entriesZh: [
      {
        name: { en: 'Signature · Ming', zh: '手书 · Ming' },
        shape: SIGNATURE_MING,
        quote: '“落墨为迹，代码为心，让逻辑在此生动起舞。”',
        author: '明神帅',
        holdMs: 20_000,
        connectionDistance: (count: number) => (count < 400 ? 0.95 : 0.45),
      },
    ],
    connectionDistance: (count: number) => (count < 400 ? 0.95 : 0.45),
  },
  {
    id: 'codex',
    label: { en: 'Classic', zh: '经典' },
    entries: CODEX,
    entriesZh: CODEX_CN,
  },
  {
    id: 'mobius',
    label: { en: 'Möbius', zh: '莫比乌斯' },
    entries: [
      {
        name: { en: 'Möbius Band', zh: '莫比乌斯环' },
        shape: MOBIUS_BAND,
        quote: '\u201CTHE BOUNDARY OF A BOUNDARY IS ZERO.\u201D',
        author: 'JOHN ARCHIBALD WHEELER',
        holdMs: 20_000,
      },
    ],
    entriesZh: [
      {
        name: { en: 'Möbius Band', zh: '莫比乌斯环' },
        shape: MOBIUS_BAND,
        quote: '“闭合却无界，行尽即重逢。”',
        author: '约翰·惠勒',
        holdMs: 20_000,
      },
    ],
    connectionDistance: (count: number) => (count < 400 ? 0.8 : 0.5),
  },
  {
    id: 'orbits',
    label: { en: 'Orbits', zh: '轨道' },
    entries: [
      {
        name: { en: 'Orbital Rings', zh: '多重轨道' },
        shape: ORBITAL_RINGS,
        quote: '\u201CNATURE USES AS LITTLE AS POSSIBLE OF ANYTHING.\u201D',
        author: 'JOHANNES KEPLER',
        holdMs: 20_000,
      },
    ],
    entriesZh: [
      {
        name: { en: 'Orbital Rings', zh: '多重轨道' },
        shape: ORBITAL_RINGS,
        quote: '“万物皆在运转，引力即是轨道。”',
        author: '开普勒',
        holdMs: 20_000,
      },
    ],
  },
];
export type ParticlePattern = HeroPatternAdapter;

export function getHeroPatternAdapter(id?: HeroPatternId): ParticlePattern {
  return HERO_PATTERN_ADAPTERS.find((adapter) => adapter.id === id) ?? HERO_PATTERN_ADAPTERS[0];
}
