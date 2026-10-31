#!/usr/bin/env node
/**
 * extract-signature.mjs
 * 
 * 自动化将手绘 SVG 签名转换为 Three.js 3D 粒子系统控制路径的工业级提取脚本。
 * 
 * 用法:
 *   node extract-signature.mjs <input.svg> [--output <file.ts>] [--epsilon <num>] [--reverse <indices>]
 * 
 * 示例:
 *   node extract-signature.mjs temp/freehand-drawing.svg --reverse 0 --output src/components/ui/signature-ming-paths.ts
 */

import fs from 'node:fs';
import path from 'node:path';

function parseArgs() {
  const args = process.argv.slice(2);
  let inputPath = '';
  let outputPath = '';
  let epsilon = 0.4;
  const reverseIndices = new Set();

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output' || args[i] === '-o') {
      outputPath = args[++i];
    } else if (args[i] === '--epsilon' || args[i] === '-e') {
      epsilon = parseFloat(args[++i]);
    } else if (args[i] === '--reverse' || args[i] === '-r') {
      const parts = args[++i].split(',');
      for (const p of parts) reverseIndices.add(parseInt(p, 10));
    } else if (!inputPath && !args[i].startsWith('-')) {
      inputPath = args[i];
    }
  }

  if (!inputPath) {
    console.error('用法: node extract-signature.mjs <input.svg> [--output <file.ts>] [--epsilon 0.4] [--reverse 0]');
    process.exit(1);
  }

  return { inputPath, outputPath, epsilon, reverseIndices };
}

// 垂直距离计算（用于 RDP 算法）
function perpendicularDistance(pt, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

// Ramer-Douglas-Peucker 曲线平滑与降维
function rdp(points, epsilon) {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const dist = perpendicularDistance(points[i], points[0], points[points.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = rdp(points.slice(0, index + 1), epsilon);
    const right = rdp(points.slice(index), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [points[0], points[points.length - 1]];
}

function processSvg() {
  const { inputPath, outputPath, epsilon, reverseIndices } = parseArgs();

  if (!fs.existsSync(inputPath)) {
    console.error(`错误: 找不到输入文件 ${inputPath}`);
    process.exit(1);
  }

  const svgContent = fs.readFileSync(inputPath, 'utf-8');
  const pathRegex = /<path[^>]+d="([^"]+)"/g;
  let match;
  const rawStrokes = [];

  while ((match = pathRegex.exec(svgContent)) !== null) {
    const d = match[1];
    const numbers = d.replace(/[MQZLAHVCSsqzlahvc]/g, ' ').trim().split(/\s+/).map(Number).filter(n => !Number.isNaN(n));
    const pts = [];
    for (let i = 0; i < numbers.length; i += 2) {
      pts.push({ x: numbers[i], y: numbers[i + 1] });
    }
    if (pts.length >= 2) {
      rawStrokes.push(pts);
    }
  }

  if (rawStrokes.length === 0) {
    console.error('未在 SVG 中检测到有效的 <path> 坐标！');
    process.exit(1);
  }

  console.log(`[1/4] 检测到 ${rawStrokes.length} 条原始笔划路径`);

  // 判定笔划类型：闭合带状轮廓 (Ribbon) 还是单线 (Centerline)
  const strokeSpines = rawStrokes.map((pts, sIdx) => {
    const dStartEnd = Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y);
    const isClosedRibbon = dStartEnd < 1.0 && pts.length > 20;

    let spine = [];
    if (isClosedRibbon) {
      const mid = Math.floor(pts.length / 2);
      let left = pts.slice(0, mid);
      let right = pts.slice(mid).reverse();

      if (reverseIndices.has(sIdx)) {
        left.reverse();
        right.reverse();
      }

      const count = Math.min(left.length, right.length);
      for (let i = 0; i < count; i++) {
        spine.push({
          x: (left[i].x + right[i].x) / 2,
          y: (left[i].y + right[i].y) / 2,
        });
      }
    } else {
      spine = reverseIndices.has(sIdx) ? [...pts].reverse() : [...pts];
    }

    const simplified = rdp(spine, epsilon);
    return {
      rawCount: pts.length,
      spineCount: spine.length,
      simplifiedCount: simplified.length,
      points: simplified,
    };
  });

  // 计算全局几何包围盒并统一坐标居中与缩放
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const s of strokeSpines) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
  }

  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(maxX - minX, maxY - minY) || 1;

  console.log(`[2/4] 画布包围盒: X[${minX.toFixed(1)}, ${maxX.toFixed(1)}], Y[${minY.toFixed(1)}, ${maxY.toFixed(1)}]`);
  console.log(`      重心: (${cx.toFixed(1)}, ${cy.toFixed(1)}), 主跨度: ${span.toFixed(1)}`);

  // 注入三维波浪微弧度深度 (Z-axis camber) 与 Y 轴翻转 (SVG -> Three.js 笛卡尔坐标)
  const paths3D = strokeSpines.map((s, sIdx) => {
    const pts = s.points;
    return pts.map((pt, i) => {
      const t = pts.length > 1 ? i / (pts.length - 1) : 0.5;
      const zArch = 0.22 * Math.sin(t * Math.PI) * (sIdx % 2 === 0 ? 1 : -0.7);
      const zTilt = ((pt.x - cx) / span) * 0.3;
      return {
        x: Number((((pt.x - cx) / span) * 2).toFixed(3)),
        y: Number((-((pt.y - cy) / span) * 2).toFixed(3)),
        z: Number((zArch + zTilt).toFixed(3)),
      };
    });
  });

  const totalPoints = paths3D.reduce((acc, p) => acc + p.length, 0);
  console.log(`[3/4] RDP 降维完成: 控制点总计 ${totalPoints} 个 (平均每划 ${Math.round(totalPoints / paths3D.length)} 点)`);

  // 计算典型笔段间距与字间距离推荐阈值
  let totalLength = 0;
  for (const p of paths3D) {
    for (let i = 1; i < p.length; i++) {
      totalLength += Math.hypot(p[i].x - p[i - 1].x, p[i].y - p[i - 1].y, p[i].z - p[i - 1].z);
    }
  }
  const avgStep800 = (totalLength / 800) * 5.5; // 世界坐标缩放比 ~5.5
  const recDesktopThresh = (avgStep800 * 1.8).toFixed(2);
  const recMobileThresh = (avgStep800 * 1.8 * 2.2).toFixed(2);

  console.log(`[4/4] 连线距离推荐阈值:`);
  console.log(`      Desktop (800 pts): ~${recDesktopThresh}`);
  console.log(`      Mobile  (250 pts): ~${recMobileThresh}`);
  console.log(`      Shape 配置公式: connectionDistance: (count) => (count < 400 ? ${recMobileThresh} : ${recDesktopThresh})`);

  // 生成 TypeScript 输出代码
  const strokeBlocks = paths3D.map((stroke, sIdx) => {
    const pts = stroke.map(p => `    { x: ${p.x}, y: ${p.y}, z: ${p.z} },`).join('\n');
    return `  // Stroke ${sIdx}\n  [\n${pts}\n  ],`;
  }).join('\n');

  const tsContent = `export interface SignaturePoint3D {
  x: number;
  y: number;
  z: number;
}

/**
 * 自动生成的 3D 签名控制路径数据
 * 源文件: ${path.basename(inputPath)}
 * 笔划数: ${paths3D.length}, 控制点数: ${totalPoints}
 */
export const SIGNATURE_MING_PATHS: SignaturePoint3D[][] = [
${strokeBlocks}
];
`;

  if (outputPath) {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, tsContent);
    console.log(`\n✅ 成功写入目标文件: ${outputPath}`);
  } else {
    console.log('\n--- TypeScript 代码片段预览 (前 25 行) ---');
    console.log(tsContent.split('\n').slice(0, 25).join('\n'));
    console.log('...\n(可通过 --output <path> 写入具体文件)');
  }
}

processSvg();
