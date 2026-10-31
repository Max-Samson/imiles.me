---
name: svg-to-threejs-signature
description: 将真实手绘 SVG 签名/矢量图形制作为高质量 Three.js 3D 粒子动画与空间星图图案的完整流程。当用户提到“制作手绘签名粒子”、“SVG转3D粒子”、“手写笔迹动画”、“配置到Hero图案”或需要在 Three.js / WebGL 中呈现真实手绘笔迹流光时使用。
---

# SVG 转换为 Three.js 3D 粒子手绘签名图案

本 Skill 提供将用户手绘 SVG 签名（如 iPad/手绘板导出的矢量画稿）转换为 Three.js 3D 粒子星图图案的完整闭环工程流程。包含笔划拓扑解析、骨架线提取、RDP 曲线轻量化、3D 空间微弧度注入、连线距离公式推导及集成到全站动画系统的生产级落地规范。

---

## 一、 系统架构与数据流

```
输入 SVG (矢量闭合带状轮廓 / 单线)
   │
   ▼
[Phase 1] 拓扑分析与笔划时间轴定序 (Ribbon Spines / Direction Reversal)
   │
   ▼
[Phase 2] Ramer-Douglas-Peucker (RDP) 曲线降维压缩 (数千坐标 -> ~150 控制点)
   │
   ▼
[Phase 3] 坐标居中、等比归一化与 Z 轴三维波浪微弧度注入 (3D Depth Camber)
   │
   ▼
[Phase 4] 空间散列与连线阈值推导 (单字连续连线，杜绝字间跨划蛛网)
   │
   ▼
输出落地:
   ├─ 模式 A: 首页 Hero / Plexus 巡游几何图案 (CODEX ShapeConfig)
   └─ 模式 B: 独立 GPU 书写推进粒子画布 (THREE.ShaderMaterial + uProgress)
```

---

## 二、 自动化提取工具（一键生成）

Skill 内置了全自动提取脚本 `.agents/skills/svg-to-threejs-signature/scripts/extract-signature.mjs`。

### 命令用法

```bash
# 基本用法：分析 SVG 并输出控制点、包围盒与阈值公式
node .agents/skills/svg-to-threejs-signature/scripts/extract-signature.mjs <input.svg>

# 生产落地：指定反转笔划索引，并将生成的 TypeScript 控制路径直接输出至项目源码
node .agents/skills/svg-to-threejs-signature/scripts/extract-signature.mjs <input.svg> \
  --reverse 0 \
  --epsilon 0.4 \
  --output src/components/ui/signature-ming-paths.ts
```

### 参数说明

| 参数 | 默认值 | 作用说明 |
| :--- | :--- | :--- |
| `<input.svg>` | 必需 | 目标 SVG 签名文件路径。 |
| `--output, -o` | 控制台预览 | 写入生成的 TypeScript 路径模块（如 `src/components/ui/signature-ming-paths.ts`）。 |
| `--epsilon, -e` | `0.4` | RDP 算法容差（像素）。值越小曲线越精细，`0.4` 在保留 <0.5px 细节的同时压缩率超 80%。 |
| `--reverse, -r` | 空 | 逗号分隔的笔划索引（如 `0` 或 `0,2`）。反转指定笔划方向，适配从下往上的起笔逻辑。 |

---

## 三、 核心阶段实现规范

### 1. SVG 笔划拓扑识别与骨架线提取

手绘画板导出的 SVG 通常分两类：
* **单线路径（Centerline Strokes）**：带有 `stroke` 属性，点序列即为笔画中心线。
* **闭合带状轮廓（Ribbon Outlines，如 perfect-freehand）**：路径为 `fill` 填充多边形（起点与终点闭合重合）。
  * 前半部分 `[0 ... mid]` 为笔划左侧轮廓；
  * 后半部分 `[mid ... N]` 逆向为笔划右侧轮廓；
  * **骨架中心点**：$C_i = \frac{P_{left}[i] + P_{right}[i]}{2}$；
  * **笔压宽度**：$W_i = \|P_{left}[i] - P_{right}[i]\|$。

```typescript
// 提取闭合轮廓笔划中心线
const mid = Math.floor(pts.length / 2);
let left = pts.slice(0, mid);
let right = pts.slice(mid).reverse();

// 针对从下往上提笔的起笔笔画执行反转
if (reverseIndices.has(strokeIdx)) {
  left.reverse();
  right.reverse();
}

const spine: { x: number; y: number }[] = [];
for (let i = 0; i < Math.min(left.length, right.length); i++) {
  spine.push({
    x: (left[i].x + right[i].x) / 2,
    y: (left[i].y + right[i].y) / 2,
  });
}
```

### 2. RDP 曲线降维与轻量化

原生采集点每划常有几百至上千个坐标，直接作为控制点会导致打包体积膨胀。采用 Ramer-Douglas-Peucker (RDP) 算法：
* $\epsilon = 0.4 \sim 0.5$：总控制点压缩至 100~150 个；
* 曲线形状保真度 $> 99.8\%$；
* TypeScript 文件体积仅 ~5 KB，且纯同构运行，零运行时加载延迟。

### 3. 三维空间深度雕刻与归一化

将 2D 笔迹映射为具有真实雕塑感的 3D 立体图案：
1. **等比归一化**：使用单一主跨度 $\text{span} = \max(\Delta X, \Delta Y)$，锁定原始签名的字形高宽比，映射至 $[-1, 1]$ 空间：
   $$X_{3D} = \frac{X - C_X}{\text{span}} \times 2, \quad Y_{3D} = -\frac{Y - C_Y}{\text{span}} \times 2$$
   *(注：Three.js 笛卡尔坐标系 $+Y$ 向上，需翻转 SVG 的 Y 坐标)*
2. **Z 轴微弧度（3D Camber）**：
   $$Z_{3D} = A \cdot \sin(t \cdot \pi) + \text{tilt} \cdot \frac{X - C_X}{\text{span}}$$
   单笔画中间凸起、两端微沉，并伴随全局倾斜角，使整体在旋转时呈现立体的运笔起伏。

### 4. 连线拓扑与空间散列阈值推导

在 Plexus 体系中，粒子间根据距离绘制发光连线。
* **目标**：同一笔划内部的粒子平滑连线；不同字母/笔划之间**绝不**产生乱网交叉。
* **数学推导公式**：
  * 单笔划相邻粒子间距：$d_{step} \approx \frac{L_{total}}{N_{particles}} \times \text{Scale}_{world}$
  * 笔划/字母间最小空隙：$d_{gap}$（通常为 $1.5 \sim 2.5$ 世界单位）
  * **连线阈值设定规则**：$d_{step} < \text{threshold} \ll d_{gap}$
  * 推荐通用公式：
    ```typescript
    connectionDistance: (count: number) => (count < 400 ? 0.95 : 0.45)
    ```

---

## 四、 模式 A：接入首页 Hero / Plexus 背景序列

用于将签名作为全站 Hero 背景的核心 3D 几何图案之一。

### 1. 放置控制路径文件
将脚本输出文件存放在 `src/components/ui/signature-ming-paths.ts`：
```typescript
export interface SignaturePoint3D {
  x: number;
  y: number;
  z: number;
}

export const SIGNATURE_MING_PATHS: SignaturePoint3D[][] = [
  // 6 组已降维的三维坐标数组
];
```

### 2. 在 `src/components/ui/plexus-shapes.ts` 中注册 Shape
```typescript
import { SIGNATURE_MING_PATHS } from './signature-ming-paths';

export const SIGNATURE_MING: ShapeConfig = {
  generate: (n) => normalize3D(sampleMultiPath3D(SIGNATURE_MING_PATHS, n)),
  spinX: 0,      // 文字/签名严禁三维自转，避免随时间翻滚形变
  spinY: 0,      // 保持正向直面视口
  spinZ: 0,
  spread: 1.35,  // 横向延展，适配屏幕视口
  jitter: 0,     // 静止状态零随机噪点，笔画锐利稳定
  lerpMul: 3.5,  // 高弹性复原系数，光标扰动后粒子毫秒级自愈归位
};
```

### 3. 配置至 CODEX 动画序列（设为 01 首发）
```typescript
export const CODEX: CodexEntry[] = [
  {
    name: { en: 'Signature · Ming', zh: '手书 · 铭' },
    shape: SIGNATURE_MING,
    quote: '\u201CCODE IS POETRY IN MOTION, LOGIC MEETS AESTHETICS.\u201D',
    author: 'SHENSHUAI MING',
    holdMs: 30_000,
    connectionDistance: (count: number) => (count < 400 ? 0.95 : 0.45),
  },
  // 后续依次为经典、莫比乌斯环等...
];
```

---

## 五、 模式 B：独立 GPU 书写推进粒子画布

用于创建独立全屏或局部卡片式的“笔迹生长推进”动画。

### Vertex Shader 核心算法
```glsl
uniform float uProgress;    // 0.0 ~ 1.0 (书写时间推进)
uniform vec3 uMousePos;     // 鼠标射线投影位置
uniform float uMouseRadius; // 鼠标斥力半径

attribute vec3 aScatterPos; // 散落混沌起始坐标
attribute float aProgress;   // 该粒子的归一化笔顺时间 [0.0, 1.0]
attribute float aScale;

varying float vAlpha;

void main() {
  // 1. 顺滑笔划延展：粒子随进度从混沌空间飞向目标签名
  float show = smoothstep(aProgress - 0.04, aProgress, uProgress);
  vec3 pos = mix(aScatterPos, position, show);

  // 2. 鼠标交互排斥
  float dist = distance(pos, uMousePos);
  if (dist < uMouseRadius) {
    vec3 dir = normalize(pos - uMousePos);
    pos += dir * pow(1.0 - dist / uMouseRadius, 2.0) * 16.0;
  }

  vAlpha = show;
  vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  gl_PointSize = (aScale * 24.0 / -mvPosition.z) * (0.3 + 0.7 * show);
}
```

### Fragment Shader 辉光算法
```glsl
uniform vec3 uColor;
varying float vAlpha;

void main() {
  vec2 coord = gl_PointCoord - vec2(0.5);
  float dist = length(coord);
  if (dist > 0.5) discard;

  float intensity = pow(1.0 - dist * 2.0, 2.0);
  gl_FragColor = vec4(uColor, intensity * vAlpha * 0.9);
}
```

---

## 六、 生产交付与质量检查清单

- [ ] **坐标居中与尺寸比例**：经 `normalize3D` 处理后，$X \in [-1, 1], Y \in [-1, 1]$，且无非等比拉伸。
- [ ] **笔顺符合手写直觉**：起笔笔划（如 M 的左腿）方向必须是从下往上，若反了必须使用 `--reverse` 修正。
- [ ] **连线不跨字乱搭**：检查连线阈值，确保字母之间无蛛网横跨。
- [ ] **DPR 上限保护**：移动端和 Retina 屏设置 `renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`，杜绝过度重绘。
- [ ] **代码规范无琐碎函数**：符合 `ts-no-tiny-functions` 规则，单行取值/包装直接在配置对象内内联。
- [ ] **构建与静态分析**：运行 `pnpm exec biome check <files>` 与 `pnpm build`，确保编译全绿、SSR 零水合报错。
