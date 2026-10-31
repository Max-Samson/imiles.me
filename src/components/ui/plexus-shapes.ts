import { SIGNATURE_MING_PATHS, SIGNATURE_SHENSHUAI_PATHS } from './signature-ming-paths';

// =============================================================================
// Shape generators for plexus-background
// Pure functions with no React dependencies.
// =============================================================================

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ShapeConfig {
  generate: (n: number) => Point3D[];
  /** Rotation speeds (rad/s) around each axis — gives each shape a unique tumble */
  spinX: number;
  spinY: number;
  spinZ: number;
  /** Multiplier on FRACTAL_SCALE — >1 enlarges footprint (less dense), <1 tightens */
  spread?: number;
  /** Multiplier on MICRO_JITTER — >1 adds more breathing motion, <1 tightens */
  jitter?: number;
  /** Multiplier on FRACTAL_LERP_SPEED — <1 slows convergence (more drift), >1 snaps faster */
  lerpMul?: number;
}

export interface CodexEntry {
  name: { en: string; zh: string };
  shape: ShapeConfig;
  quote: string;
  author?: string;
  holdMs: number;
  connectionDistance?: (particleCount: number) => number;
}

// =============================================================================
// Helpers
// =============================================================================

/** Box-Muller transform: returns a standard-normal random variate */
function gaussRandom(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

/** Normalize 3D points into [-1,1] range using a single uniform scale factor */
function normalize3D(pts: Point3D[]): Point3D[] {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ) || 1;
  return pts.map((p) => ({
    x: ((p.x - cx) / span) * 2,
    y: ((p.y - cy) / span) * 2,
    z: ((p.z - cz) / span) * 2,
  }));
}

/**
 * Normalize galaxy points preserving the thin disk shape
 * (generic normalize3D would inflate Z independently).
 */
function normalizeGalaxy(pts: Point3D[]): Point3D[] {
  let minX = Infinity,
    maxX = -Infinity;
  let minY = Infinity,
    maxY = -Infinity;
  let minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
    if (p.z < minZ) minZ = p.z;
    if (p.z > maxZ) maxZ = p.z;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;
  return pts.map((p) => ({
    x: ((p.x - cx) / span) * 2,
    y: ((p.y - cy) / span) * 2,
    z: ((p.z - cz) / span) * 2,
  }));
}

/** Sample n evenly-spaced points along a 3D polyline path */
function sampleAlongPath3D(path: Point3D[], n: number): Point3D[] {
  if (path.length < 2 || n <= 0) return [];
  const segLens: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i].x - path[i - 1].x;
    const dy = path[i].y - path[i - 1].y;
    const dz = path[i].z - path[i - 1].z;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    segLens.push(len);
    total += len;
  }
  if (total === 0) return Array.from({ length: n }, () => ({ ...path[0] }));
  const pts: Point3D[] = [];
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    let acc = 0;
    for (let j = 0; j < segLens.length; j++) {
      if (acc + segLens[j] >= d || j === segLens.length - 1) {
        const t = segLens[j] > 0 ? (d - acc) / segLens[j] : 0;
        pts.push({
          x: path[j].x + (path[j + 1].x - path[j].x) * t,
          y: path[j].y + (path[j + 1].y - path[j].y) * t,
          z: path[j].z + (path[j + 1].z - path[j].z) * t,
        });
        break;
      }
      acc += segLens[j];
    }
  }
  return pts;
}

/** Sample n points across multiple 3D polyline paths, proportional to path length */
function sampleMultiPath3D(paths: Point3D[][], n: number): Point3D[] {
  const lens: number[] = [];
  let total = 0;
  for (const path of paths) {
    let len = 0;
    for (let i = 1; i < path.length; i++) {
      const dx = path[i].x - path[i - 1].x;
      const dy = path[i].y - path[i - 1].y;
      const dz = path[i].z - path[i - 1].z;
      len += Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    lens.push(len);
    total += len;
  }
  if (total === 0) return [];
  const pts: Point3D[] = [];
  let remaining = n;
  for (let i = 0; i < paths.length; i++) {
    const count =
      i === paths.length - 1 ? remaining : Math.max(2, Math.round((n * lens[i]) / total));
    const actual = Math.min(count, remaining);
    if (actual > 0) {
      pts.push(...sampleAlongPath3D(paths[i], actual));
      remaining -= actual;
    }
    if (remaining <= 0) break;
  }
  return pts;
}

// =============================================================================
// Shape generators
// =============================================================================

// --- 1. Faravahar (Zoroastrian winged sun disc) ---

function generateFaravahar(n: number): Point3D[] {
  const paths: Point3D[][] = [];
  // Central disc with subtle spherical convexity
  const disc: Point3D[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    disc.push({ x: 0.12 * Math.cos(a), y: 0.12 * Math.sin(a), z: 0.08 * Math.cos(a * 2) });
  }
  paths.push(disc);
  // Three layers of wings with aerodynamic spatial camber
  for (let layer = 0; layer < 3; layer++) {
    const r = 0.35 + layer * 0.22;
    const sweep = 0.7 + layer * 0.2;
    const yOff = layer * 0.06;
    const left: Point3D[] = [];
    const right: Point3D[] = [];
    for (let i = 0; i <= 25; i++) {
      const t = i / 25;
      const a = Math.PI - sweep + t * sweep;
      const zWing = -0.2 * Math.sin(t * Math.PI) * (layer + 1) * 0.35;
      left.push({
        x: -0.15 + r * Math.cos(a),
        y: yOff + r * Math.sin(a) * 0.35,
        z: zWing,
      });
      const a2 = sweep - t * sweep;
      right.push({
        x: 0.15 + r * Math.cos(a2),
        y: yOff + r * Math.sin(a2) * 0.35,
        z: zWing,
      });
    }
    paths.push(left, right);
  }
  // Tail streamers flowing gently forward
  paths.push(
    [
      { x: 0, y: -0.15, z: 0 },
      { x: 0, y: -0.6, z: 0.1 },
    ],
    [
      { x: -0.05, y: -0.15, z: 0 },
      { x: -0.2, y: -0.55, z: 0.08 },
    ],
    [
      { x: 0.05, y: -0.15, z: 0 },
      { x: 0.2, y: -0.55, z: 0.08 },
    ],
  );
  return normalize3D(sampleMultiPath3D(paths, n));
}

// --- 2. Heptagram (Tajik {7/2} star polygon) ---

function generateHeptagram(n: number): Point3D[] {
  const paths: Point3D[][] = [];
  // {7/2} star polygon on front depth plane
  const starFront: Point3D[] = [];
  for (let i = 0; i <= 7; i++) {
    const vertIdx = (i * 2) % 7;
    const angle = (vertIdx / 7) * Math.PI * 2 - Math.PI / 2;
    starFront.push({ x: Math.cos(angle), y: Math.sin(angle), z: 0.18 });
  }
  paths.push(starFront);
  // {7/3} inner star polygon on rear depth plane
  const starRear: Point3D[] = [];
  for (let i = 0; i <= 7; i++) {
    const vertIdx = (i * 3) % 7;
    const angle = (vertIdx / 7) * Math.PI * 2 - Math.PI / 2;
    starRear.push({ x: 0.58 * Math.cos(angle), y: 0.58 * Math.sin(angle), z: -0.18 });
  }
  paths.push(starRear);
  // Circumscribing equatorial ring
  const ring: Point3D[] = [];
  for (let i = 0; i <= 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    ring.push({ x: Math.cos(a), y: Math.sin(a), z: 0 });
  }
  paths.push(ring);
  // Connective struts between front star points and rear
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2 - Math.PI / 2;
    paths.push([
      { x: Math.cos(angle), y: Math.sin(angle), z: 0.18 },
      { x: 0.58 * Math.cos(angle), y: 0.58 * Math.sin(angle), z: -0.18 },
    ]);
  }
  return normalize3D(sampleMultiPath3D(paths, n));
}

// --- 3. Girih Decagon (Persian geometric tile) ---

function generateGirihDecagon(n: number): Point3D[] {
  const paths: Point3D[][] = [];
  // Outer decagon
  const decVerts: Point3D[] = [];
  for (let i = 0; i < 10; i++) {
    const angle = (i / 10) * Math.PI * 2 - Math.PI / 2;
    decVerts.push({ x: Math.cos(angle), y: Math.sin(angle), z: 0 });
  }
  paths.push([...decVerts, decVerts[0]]);
  // Internal {10/3} star lines rising toward vaulted apex
  for (let i = 0; i < 10; i++) {
    const v1 = decVerts[i];
    const v2 = decVerts[(i + 3) % 10];
    const midX = (v1.x + v2.x) * 0.5;
    const midY = (v1.y + v2.y) * 0.5;
    const archPeak: Point3D = { x: midX, y: midY, z: 0.32 };
    paths.push([v1, archPeak, v2]);
  }
  return normalize3D(sampleMultiPath3D(paths, n));
}

// --- 4. Flower of Life (sacred geometry) ---

function generateFlowerOfLife(n: number): Point3D[] {
  const paths: Point3D[][] = [];
  const r = 0.35;
  const makeCircle = (cx: number, cy: number, zBase: number): Point3D[] => {
    const c: Point3D[] = [];
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * Math.PI * 2;
      const x = cx + r * Math.cos(a);
      const y = cy + r * Math.sin(a);
      const dist = Math.sqrt(x * x + y * y);
      const z = zBase + 0.18 * Math.cos(dist * 2.2);
      c.push({ x, y, z });
    }
    return c;
  };
  // Center circles on front and rear spherical dome
  paths.push(makeCircle(0, 0, 0.12));
  paths.push(makeCircle(0, 0, -0.12));
  // Ring of 6 on front and rear dome
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    paths.push(makeCircle(r * Math.cos(a), r * Math.sin(a), 0.08));
    paths.push(makeCircle(r * Math.cos(a), r * Math.sin(a), -0.08));
  }
  return normalize3D(sampleMultiPath3D(paths, n));
}

// --- 5. Sierpinski Triangle (fractal) ---

function generateSierpinski(n: number): Point3D[] {
  // Regular 3D tetrahedron vertices forming a 3D fractal pyramid
  const verts: Point3D[] = [
    { x: 1, y: 1, z: 1 },
    { x: 1, y: -1, z: -1 },
    { x: -1, y: 1, z: -1 },
    { x: -1, y: -1, z: 1 },
  ];
  const pts: Point3D[] = [];
  let x = 0,
    y = 0,
    z = 0;
  const warmup = 30;
  for (let i = 0; i < n + warmup; i++) {
    const v = verts[Math.floor(Math.random() * 4)];
    x = (x + v.x) * 0.5;
    y = (y + v.y) * 0.5;
    z = (z + v.z) * 0.5;
    if (i >= warmup) pts.push({ x, y, z });
  }
  return normalize3D(pts);
}

// --- 6. Lorenz Attractor (chaos theory) ---

function generateLorenzAttractor(n: number): Point3D[] {
  const pts: Point3D[] = [];
  let x = 0.1,
    y = 0,
    z = 0;
  const sigma = 10,
    rho = 28,
    beta = 8 / 3;
  const dt = 0.005;
  const warmup = 500;
  const steps = n + warmup;
  for (let i = 0; i < steps; i++) {
    const dx = sigma * (y - x);
    const dy = x * (rho - z) - y;
    const dz = x * y - beta * z;
    x += dx * dt;
    y += dy * dt;
    z += dz * dt;
    if (i >= warmup) {
      pts.push({ x, y, z });
    }
  }
  return normalize3D(pts);
}

// --- 7. Golden Spiral (Fibonacci / nature) ---

function generateGoldenSpiral(n: number): Point3D[] {
  const pts: Point3D[] = [];
  const phi = (1 + Math.sqrt(5)) / 2;
  const b = Math.log(phi) / (Math.PI / 2);
  const maxTheta = 6 * Math.PI;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * maxTheta;
    const r = 0.02 * Math.exp(b * t);
    const normR = Math.min(1, r / 1.2);
    // 3D Nautilus shell cone: lifts in Z with radial expansion
    const z = 0.45 * (1 - normR * 0.75) * Math.cos(t * 0.25) + Math.sin(t) * 0.06;
    pts.push({ x: r * Math.cos(t), y: r * Math.sin(t), z });
  }
  return normalize3D(pts);
}

// --- 8. Galaxy Spiral (cosmic identity) ---

function generateGalaxySpiral(n: number): Point3D[] {
  const pts: Point3D[] = [];

  const numMajorArms = 4;
  const numMinorArms = 2;
  const pitchDeg = 12;
  const b = Math.tan((pitchDeg * Math.PI) / 180);

  const bulgeFrac = 0.15;
  const fieldFrac = 0.2;

  const nBulge = Math.round(n * bulgeFrac);
  const nField = Math.round(n * fieldFrac);
  const nArms = n - nBulge - nField;

  const majorWeight = 2;
  const minorWeight = 1;
  const totalWeight = numMajorArms * majorWeight + numMinorArms * minorWeight;
  const nPerMajor = Math.round((nArms * majorWeight) / totalWeight);
  const nPerMinor = Math.round((nArms * minorWeight) / totalWeight);

  // Spiral arms
  const totalArms = numMajorArms + numMinorArms;
  let remainingArms = nArms;
  for (let arm = 0; arm < totalArms; arm++) {
    const isMajor = arm < numMajorArms;
    const count =
      arm === totalArms - 1
        ? remainingArms
        : Math.min(remainingArms, isMajor ? nPerMajor : nPerMinor);
    remainingArms -= count;
    const baseAngle = isMajor
      ? (arm / numMajorArms) * Math.PI * 2
      : ((arm - numMajorArms) / numMinorArms) * Math.PI * 2 + Math.PI / 4;
    const armWidth = isMajor ? 0.12 : 0.08;

    for (let i = 0; i < count; i++) {
      const t = Math.random();
      const r = 0.1 + t * 0.9;
      const theta = baseAngle + Math.log(r / 0.02 + 1) / b;
      const scatter = gaussRandom() * armWidth * (0.5 + r * 0.5);
      const px = r * Math.cos(theta) + scatter * Math.cos(theta + Math.PI / 2);
      const py = r * Math.sin(theta) + scatter * Math.sin(theta + Math.PI / 2);
      const zScale = 0.04 * Math.exp(-r * 2.5);
      const pz = gaussRandom() * zScale;
      pts.push({ x: px, y: py, z: pz });
    }
  }

  // Central bulge
  for (let i = 0; i < nBulge; i++) {
    const r = Math.abs(gaussRandom()) * 0.15;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pts.push({
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi) * 0.4,
    });
  }

  // Field stars
  for (let i = 0; i < nField; i++) {
    const r = -0.3 * Math.log(1 - Math.random() * 0.99);
    const theta = Math.random() * Math.PI * 2;
    const zScale = 0.03 * Math.exp(-r * 2);
    pts.push({
      x: r * Math.cos(theta),
      y: r * Math.sin(theta),
      z: gaussRandom() * zScale,
    });
  }

  return normalizeGalaxy(pts);
}

// Three intersecting, tilted orbital rings form a genuinely volumetric silhouette.
function generateOrbitalRings(n: number): Point3D[] {
  const pts: Point3D[] = [];
  const tilt = Math.PI / 3;
  for (let i = 0; i < n; i++) {
    const ring = i % 3;
    const angle = (Math.floor(i / 3) / Math.ceil((n - ring) / 3)) * Math.PI * 2;
    const radius = ring === 1 ? 0.77 : 1;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    if (ring === 0) {
      pts.push({ x, y: y * Math.cos(tilt), z: y * Math.sin(tilt) });
    } else if (ring === 1) {
      pts.push({ x: x * Math.cos(tilt), y, z: x * Math.sin(tilt) });
    } else {
      pts.push({ x: x * Math.cos(tilt), y: y * Math.cos(tilt), z: (x - y) * Math.sin(tilt) });
    }
  }
  return normalize3D(pts);
}

// Sample across the surface so the half twist reads as a ribbon, not a wire loop.
function generateMobiusBand(n: number): Point3D[] {
  const pts: Point3D[] = [];
  const strips = n < 400 ? 5 : 11;
  const radius = 0.8;
  const halfWidth = 0.38;
  for (let i = 0; i < n; i++) {
    const strip = i % strips;
    const column = Math.floor(i / strips);
    const columns = Math.ceil((n - strip) / strips);
    const u = (column / columns) * Math.PI * 2;
    const v = (strip / (strips - 1) - 0.5) * 2 * halfWidth;
    const ringRadius = radius + v * Math.cos(u / 2);
    const x = ringRadius * Math.cos(u);
    const y = ringRadius * Math.sin(u);
    const z = v * Math.sin(u / 2);
    // Present the twist at an angle before the slow ambient rotation begins.
    pts.push({ x, y: y * 0.87 - z * 0.5, z: y * 0.5 + z * 0.87 });
  }
  return normalize3D(pts);
}

// =============================================================================
// Shape configurations
// =============================================================================

const faravaharShape: ShapeConfig = {
  generate: generateFaravahar,
  spinX: 0.02,
  spinY: 0.04,
  spinZ: 0.06,
  spread: 1.2,
};

const heptagramShape: ShapeConfig = {
  generate: generateHeptagram,
  spinX: 0.03,
  spinY: 0.06,
  spinZ: 0.08,
};

const girihDecagonShape: ShapeConfig = {
  generate: generateGirihDecagon,
  spinX: 0,
  spinY: 0.05,
  spinZ: 0.1,
  spread: 1.1,
};

const flowerOfLifeShape: ShapeConfig = {
  generate: generateFlowerOfLife,
  spinX: 0.02,
  spinY: 0.06,
  spinZ: 0.04,
};

const sierpinskiShape: ShapeConfig = {
  generate: generateSierpinski,
  spinX: 0.05,
  spinY: 0.08,
  spinZ: 0,
  spread: 1.1,
};

const lorenzShape: ShapeConfig = {
  generate: generateLorenzAttractor,
  spinX: 0.04,
  spinY: 0.06,
  spinZ: 0.03,
};

const goldenSpiralShape: ShapeConfig = {
  generate: generateGoldenSpiral,
  spinX: 0,
  spinY: 0.03,
  spinZ: 0.1,
  spread: 1.1,
};

const galaxyShape: ShapeConfig = {
  generate: generateGalaxySpiral,
  spinX: 0,
  spinY: 0,
  spinZ: 0.12,
  spread: 1.4,
  jitter: 0.6,
  lerpMul: 0.6,
};

export const ORBITAL_RINGS: ShapeConfig = {
  generate: generateOrbitalRings,
  spinX: 0.08,
  spinY: 0.12,
  spinZ: 0.025,
  spread: 1.15,
  jitter: 0.35,
};

export const MOBIUS_BAND: ShapeConfig = {
  generate: generateMobiusBand,
  spinX: 0.035,
  spinY: 0.085,
  spinZ: 0.02,
  spread: 1.25,
  jitter: 0.12,
};

/** 英文花体手绘签名「Ming」（当前激活展示） */
export const SIGNATURE_MING: ShapeConfig = {
  generate: (n) => normalize3D(sampleMultiPath3D(SIGNATURE_MING_PATHS, n)),
  spinX: 0,
  spinY: 0,
  spinZ: 0,
  spread: 1.35,
  jitter: 0,
  lerpMul: 3.5,
};

/** 中文行草手绘签名（已完整保留，暂时不展示） */
export const SIGNATURE_SHENSHUAI_ZH: ShapeConfig = {
  generate: (n) => normalize3D(sampleMultiPath3D(SIGNATURE_SHENSHUAI_PATHS, n)),
  spinX: 0,
  spinY: 0,
  spinZ: 0,
  spread: 1.35,
  jitter: 0,
  lerpMul: 3.5,
};

// =============================================================================
// Codex — 历史原有经典星图序列（包含 8 组科学哲学图谱连续流动显示）
// 包含 3c8112b 之前历史首屏就有的经典几何：法拉瓦哈、七角星、十角拼花、生命之花、
// 谢尔宾斯基、洛伦兹吸引子、黄金螺旋、旋涡星系。在经典组中作为一个整体依序演变展示。
// =============================================================================

export interface ClassicVariant extends CodexEntry {}

export const CODEX: readonly CodexEntry[] = [
  // 01. 法拉瓦哈 (Faravahar)
  {
    name: { en: 'Faravahar', zh: '法拉瓦哈' },
    shape: faravaharShape,
    quote: '\u201CMAKE IT WORK, MAKE IT RIGHT, MAKE IT FAST.\u201D',
    author: 'KENT BECK',
    holdMs: 10_000,
  },
  // 02. 七角星 (Heptagram)
  {
    name: { en: 'Heptagram', zh: '七角星' },
    shape: heptagramShape,
    quote: '\u201CSIMPLICITY IS PREREQUISITE FOR RELIABILITY.\u201D',
    author: 'EDSGER DIJKSTRA',
    holdMs: 10_000,
  },
  // 03. 十角拼花 (Girih Decagon)
  {
    name: { en: 'Girih Decagon', zh: '十角拼花' },
    shape: girihDecagonShape,
    quote: '\u201CPREMATURE OPTIMIZATION IS THE ROOT OF ALL EVIL.\u201D',
    author: 'DONALD KNUTH',
    holdMs: 10_000,
  },
  // 04. 生命之花 (Flower of Life)
  {
    name: { en: 'Flower of Life', zh: '生命之花' },
    shape: flowerOfLifeShape,
    quote: '\u201CPROGRAMS MUST BE WRITTEN FOR PEOPLE TO READ.\u201D',
    author: 'HAL ABELSON',
    holdMs: 10_000,
  },
  // 05. 谢尔宾斯基金字塔 (Sierpinski Pyramid)
  {
    name: { en: 'Sierpinski Pyramid', zh: '谢尔宾斯基' },
    shape: sierpinskiShape,
    quote: '\u201CANY SUFFICIENTLY ADVANCED TECHNOLOGY IS INDISTINGUISHABLE FROM MAGIC.\u201D',
    author: 'ARTHUR C. CLARKE',
    holdMs: 10_000,
  },
  // 06. 洛伦兹吸引子 (Lorenz Attractor)
  {
    name: { en: 'Lorenz Attractor', zh: '洛伦兹吸引子' },
    shape: lorenzShape,
    quote: '\u201CTHE BEST WAY TO PREDICT THE FUTURE IS TO INVENT IT.\u201D',
    author: 'ALAN KAY',
    holdMs: 10_000,
  },
  // 07. 黄金螺旋 (Golden Spiral)
  {
    name: { en: 'Golden Spiral', zh: '黄金螺旋' },
    shape: goldenSpiralShape,
    quote: '\u201CSTAY HUNGRY, STAY FOOLISH.\u201D',
    author: 'STEWART BRAND',
    holdMs: 10_000,
  },
  // 08. 旋涡星系 (Spiral Galaxy)
  {
    name: { en: 'Spiral Galaxy', zh: '旋涡星系' },
    shape: galaxyShape,
    quote: '\u201CWE ARE ALL IN THE GUTTER, BUT SOME OF US ARE LOOKING AT THE STARS.\u201D',
    author: 'OSCAR WILDE',
    holdMs: 10_000,
  },
];

export const CODEX_CN: readonly CodexEntry[] = [
  // 01. 法拉瓦哈 (Faravahar)
  {
    name: { en: 'Faravahar', zh: '法拉瓦哈' },
    shape: faravaharShape,
    quote: '“先让它跑起来，再让它跑得漂亮。”',
    author: '肯特·贝克',
    holdMs: 10_000,
  },
  // 02. 七角星 (Heptagram)
  {
    name: { en: 'Heptagram', zh: '七角星' },
    shape: heptagramShape,
    quote: '“简单是可靠的前提。”',
    author: '迪杰斯特拉',
    holdMs: 10_000,
  },
  // 03. 十角拼花 (Girih Decagon)
  {
    name: { en: 'Girih Decagon', zh: '十角拼花' },
    shape: girihDecagonShape,
    quote: '“过早优化，是万恶之源。”',
    author: '高德纳',
    holdMs: 10_000,
  },
  // 04. 生命之花 (Flower of Life)
  {
    name: { en: 'Flower of Life', zh: '生命之花' },
    shape: flowerOfLifeShape,
    quote: '“程序是写给人读的，只是顺便能在机器上跑。”',
    author: '阿贝尔森',
    holdMs: 10_000,
  },
  // 05. 谢尔宾斯基金字塔 (Sierpinski Pyramid)
  {
    name: { en: 'Sierpinski Pyramid', zh: '谢尔宾斯基' },
    shape: sierpinskiShape,
    quote: '“任何足够先进的技术，都与魔法无异。”',
    author: '克拉克',
    holdMs: 10_000,
  },
  // 06. 洛伦兹吸引子 (Lorenz Attractor)
  {
    name: { en: 'Lorenz Attractor', zh: '洛伦兹吸引子' },
    shape: lorenzShape,
    quote: '“预测未来最好的方式，就是把它实现出来。”',
    author: '艾伦·凯',
    holdMs: 10_000,
  },
  // 07. 黄金螺旋 (Golden Spiral)
  {
    name: { en: 'Golden Spiral', zh: '黄金螺旋' },
    shape: goldenSpiralShape,
    quote: '“保持饥饿，保持愚蠢。”',
    author: '斯图尔特·布兰德',
    holdMs: 10_000,
  },
  // 08. 旋涡星系 (Spiral Galaxy)
  {
    name: { en: 'Spiral Galaxy', zh: '旋涡星系' },
    shape: galaxyShape,
    quote: '“我们都在阴沟里，但仍有人仰望星空。”',
    author: '奥斯卡·王尔德',
    holdMs: 10_000,
  },
];

export const CLASSIC_VARIANTS = CODEX;
export const CLASSIC_VARIANTS_CN = CODEX_CN;
