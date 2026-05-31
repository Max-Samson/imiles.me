# Three.js Plexus Background 解析与改造方案

本文解析项目中 `src/components/ui` 目录下的 Three.js 粒子连线背景实现，重点回答这几个问题：

- 它现在是怎么绘制出来的
- 图案是不是能调整
- 如果要改成新的图案、动态或风格，应该从哪里下手
- 怎样低风险迭代

## 1. 代码入口与文件地图

这一套背景效果的核心文件都在：

- `src/components/ui/plexus-background.tsx`
- `src/components/ui/plexus-shapes.ts`
- `src/components/ui/plexus-webgl/PlexusScene.tsx`
- `src/components/ui/plexus-webgl/ParticleField.tsx`
- `src/components/ui/plexus-webgl/ConnectionLines.tsx`
- `src/components/ui/plexus-webgl/PostProcessing.tsx`
- `src/components/ui/plexus-webgl/shaders.ts`
- `src/components/ui/plexus-webgl/usePlexusTheme.ts`

页面接入点在：

- `src/components/LandingExperience.tsx`

也就是说，这个项目里的 Three.js 绘制逻辑不是分散在页面里，而是已经被封装成一套独立的“粒子背景系统”。

## 2. 整体渲染链路

实际渲染链路可以概括成：

`LandingExperience`
-> `PlexusBackground`
-> `PlexusScene`
-> `ParticleField` + `ConnectionLines` + `PostProcessing`

### 2.1 `LandingExperience.tsx` 做了什么

首页组件里挂载了：

```tsx
<PlexusBackground className="pointer-events-auto" onCodexChange={handleCodexChange} />
```

这里说明两件事：

- 背景是首页 Hero 区的固定全屏背景
- 背景内部会轮播不同图案，并把当前图案序号通过 `onCodexChange` 回传给页面

页面再用这个序号去切换文案 `CODEX / CODEX_CN`，所以背景图案和首页引言文字是同步变化的。

### 2.2 `plexus-background.tsx` 做了什么

这个文件很薄，主要作用是：

- 用 `React.lazy` 延迟加载真正的 WebGL 场景
- 避免 Three.js 首屏阻塞

也就是说它不是绘制核心，只是“懒加载壳子”。

### 2.3 `PlexusScene.tsx` 做了什么

这个文件是场景调度中心，负责：

- 创建 `@react-three/fiber` 的 `Canvas`
- 设置相机参数
- 根据屏幕宽度判断性能档位
- 决定粒子数量
- 监听鼠标/触摸事件并转成世界坐标
- 把共享数据传给粒子层和连线层

关键参数：

- `camera.position = [0, 0, 15]`
- `fov = 60`
- `particleCount = desktop ? 800 : 250`
- `frameloop = "always"`
- `dpr = [1, 1.5]`

这里的设计思路是：

- 相机保持稳定，不做复杂镜头运动
- 视觉变化主要来自粒子目标形状、微扰动、连线和 bloom
- 移动端降低粒子数量来保性能

## 3. 真正“画出来”的方式

这一套效果本质上不是“直接画一张固定图”，而是：

1. 先生成一组目标点位
2. 再让大量粒子逐渐靠拢这些目标点
3. 每帧根据粒子间距离动态生成连线
4. 最后通过 shader 和 bloom 做发光强化

所以它更像“粒子编队形成图案”，不是传统静态几何建模。

## 4. 图案来源：`plexus-shapes.ts`

这个文件是最关键的“图案定义层”。

### 4.1 数据结构

核心类型有：

```ts
export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface ShapeConfig {
  generate: (n: number) => Point3D[];
  spinX: number;
  spinY: number;
  spinZ: number;
  spread?: number;
  jitter?: number;
  lerpMul?: number;
}
```

理解这几个字段很重要：

- `generate(n)`：生成目标点阵
- `spinX/Y/Z`：图案在形成后如何绕三轴缓慢旋转
- `spread`：图案整体放大/收紧
- `jitter`：粒子呼吸感、抖动感
- `lerpMul`：粒子收敛到目标图形的速度

### 4.2 当前已有的图案

目前项目内置了这些目标形状：

- Faravahar
- Heptagram
- Girih Decagon
- Flower of Life
- Sierpinski Triangle
- Lorenz Attractor
- Golden Spiral
- Galaxy Spiral

它们本质上都返回 `Point3D[]`。

也就是说，项目并不限制你只能画“线框几何图形”，你只要能生成一组 3D 点，就能被这个系统吸收。

### 4.3 这些图案是怎么生成的

源码里用了几种不同策略：

- 沿路径采样
  - 例如圆、星形、多边形、翅膀、几何纹样
  - 先构造 polyline 路径，再按路径长度均匀取样
- 分形/混沌迭代
  - 例如 Sierpinski、Lorenz
- 程序化随机分布
  - 例如 Galaxy Spiral，用高斯分布、螺旋臂、bulge、field stars 组合

这套设计非常适合继续扩展新图案。

## 5. 粒子层：`ParticleField.tsx`

这个文件负责“点”。

### 5.1 粒子初始化

初始时会创建若干粒子缓冲区：

- `position`
- `aSize`
- `aPhase`
- `aColorT`

含义：

- `position`：粒子当前 3D 坐标
- `aSize`：每个粒子大小
- `aPhase`：每个粒子的独立摆动相位
- `aColorT`：颜色插值参数

一开始粒子随机散布在一个较大的空间里，不是直接排成目标图案。

### 5.2 图案切换机制

`ParticleField` 使用 `CODEX` 数组轮播图案。

每个条目包含：

- `shape`
- `quote`
- `author`
- `holdMs`

轮播逻辑是：

- 初始化第一个图案
- 每隔一段时间切到下一个图案
- 每次切换时重新生成目标点位 `shape.generate(count)`

这就是为什么首页背景会“变形成下一个符号”。

### 5.3 每帧动画逻辑

每一帧大概做这些事：

1. 更新时间 `uTime`
2. 计算当前图案旋转角
3. 把目标点乘上旋转矩阵
4. 根据 `spread` 缩放到当前视口尺寸
5. 给目标点加入轻微 jitter
6. 让当前粒子位置用 `lerp` 方式逼近目标点
7. 叠加鼠标/触摸引力或斥力
8. 更新 Z 方向边界约束
9. 回写到 `BufferGeometry`

这说明视觉上的“图形形成”并不是 shader 内部做的，而是 CPU 每帧更新粒子位置后，再交给 GPU 绘制。

### 5.4 鼠标交互

交互参数主要有：

- `CURSOR_STRENGTH`
- `CURSOR_RADIUS`
- `CURSOR_SOFTENING`
- `CURSOR_MAX_FORCE`

点击页面时，会在吸引和排斥模式之间切换：

- `mode = 1`
- `mode = -1`

所以这个背景本身是可交互的，不只是自动播放。

## 6. 连线层：`ConnectionLines.tsx`

这个文件负责“线”。

如果直接对每两个粒子做距离判断，复杂度会接近 `O(n^2)`，粒子多时会很重。

这里用了一个更聪明的办法：空间网格哈希。

### 6.1 连线思路

每帧会：

1. 先读取当前所有粒子位置
2. 按 `x/y` 把粒子塞进二维网格
3. 对每个粒子只检查自己所在格子及周围 8 个格子
4. 如果两个粒子足够近，就生成一条线段

关键限制参数：

- `CONNECTION_DIST = 3.0`
- `Z_CONNECTION_MAX = 4.0`
- `MAX_CONNECTIONS = 5000`
- `MAX_GRID = 64`

这表示：

- 平面距离太远不连
- Z 深度差太大不连
- 单帧最多只画 5000 条线

### 6.2 线透明度

透明度由两部分控制：

- 平面距离越近，线越明显
- Z 深度越接近，线越明显

所以你看到的不是纯随机蜘蛛网，而是“贴着当前粒子结构”的动态网络。

## 7. Shader 层：`shaders.ts`

这里定义了粒子和线的 GLSL shader。

### 7.1 粒子 shader 做了什么

粒子顶点着色器里做了：

- 轻微 breathing motion
- 根据时间计算能量波 `waveEnergy`
- 根据深度决定点大小
- 根据能量提升粒子尺寸

粒子片元着色器里做了：

- 圆形软边
- 两种主题色插值
- 能量高时向白色偏移
- 中心增强发光

所以视觉重点并不是“模型复杂”，而是“点本身带有发光和脉冲生命感”。

### 7.2 线 shader 做了什么

线的 shader 比较轻，主要是：

- 复用同一套 `waveEnergy`
- 在线上叠加亮度变化
- 在高能量时更亮、更接近白色

这让线和粒子在节奏上是同步的。

## 8. 后处理：`PostProcessing.tsx`

这里用了：

- `EffectComposer`
- `RenderPass`
- `UnrealBloomPass`
- `OutputPass`

作用很明确：

- 先正常渲染场景
- 再给高亮区域加 bloom
- 最后输出

所以“高级感”的一部分其实来自后处理，不仅是粒子本身。

如果你把 bloom 去掉，这个背景会变得更“技术线框”，少一点氛围。

## 9. 主题层：`usePlexusTheme.ts`

这个文件控制暗色/亮色下的配色和 blending。

暗色主题：

- 金色粒子
- 金色线
- `AdditiveBlending`
- bloom 稍强

亮色主题：

- 深石墨色粒子
- 深石墨色线
- `NormalBlending`
- bloom 更克制

它的设计思路是：

- 暗色模式强调光感
- 亮色模式强调精致墨点感

## 10. 你能不能调整绘制图案

可以，而且这个项目本身就已经为“换图案”预留了很好的结构。

最直接的答案是：

- 能改图案
- 能加新图案
- 能改图案切换顺序
- 能让图案不轮播，只固定一种
- 能把现在的“点线网络”改成别的视觉风格，但改造量会更大

## 11. 最容易改的部分

### 11.1 新增一个目标图案

这是最推荐、成本最低的方式。

做法：

1. 在 `plexus-shapes.ts` 新增一个 `generateXxx(n)` 函数
2. 返回 `Point3D[]`
3. 包装成 `ShapeConfig`
4. 插入 `CODEX` 或 `CODEX_CN`

适合做的图案：

- Logo 轮廓
- 首字母 M / SM
- 圆环 / 双螺旋 / DNA
- 心形 / 花瓣 / 星云
- 中国结、太极、八卦、山脉轮廓
- 更抽象的波形、声纹、轨道

### 11.2 调整图案“形成方式”

可改参数主要在 `ShapeConfig` 和 `ParticleField.tsx` 常量里：

- `spread`
- `jitter`
- `lerpMul`
- `FRACTAL_SCALE`
- `FRACTAL_LERP_SPEED`
- `MICRO_JITTER`

这些参数控制的是“同一个图案看起来有多松、多稳、多灵动”。

### 11.3 调整连线风格

改 `ConnectionLines.tsx` 里的参数即可：

- `CONNECTION_DIST`
- `Z_CONNECTION_MAX`
- `MAX_CONNECTIONS`

效果趋势：

- 距离更大：网络更密、更像神经网络
- 距离更小：图案轮廓更干净
- 最大连线数更高：更饱满，但更吃性能

### 11.4 调整整体视觉风格

改这些地方：

- `usePlexusTheme.ts`：色彩、bloom、blending
- `shaders.ts`：粒子边缘、能量波、颜色过渡
- `PostProcessing.tsx`：发光强度

## 12. 如果你想“改绘制的图案”，建议分三种级别理解

### 级别 A：只换目标图案

这是最安全的改法。

你不需要动 WebGL 架构，只需要改：

- `plexus-shapes.ts`

适合：

- 想做品牌化图形
- 想换成更符合个人站气质的视觉符号
- 想保留现有点线发光风格

### 级别 B：保留粒子系统，但改动态表现

需要动：

- `ParticleField.tsx`
- `ConnectionLines.tsx`
- `shaders.ts`

适合：

- 想让粒子像流体
- 想让线有扫光、断续、拖尾
- 想让图形形成过程更戏剧化

### 级别 C：改成完全不同的绘制语言

例如：

- 改成 `InstancedMesh` 几何体
- 改成 ribbon / tube / curve
- 改成纯 shader 的 signed distance field
- 改成 FBO/GPGPU 粒子模拟

这种已经不是“调图案”，而是“重做渲染方案”。

## 13. 实现思路总结

这个背景的实现思路可以总结为一句话：

> 用程序生成目标点阵，再让随机粒子场逐帧收敛成图案，同时按距离实时织出连线，并用 shader + bloom 提升氛围。

拆开看是四层：

1. 图案层
   `plexus-shapes.ts` 负责“目标长什么样”
2. 运动层
   `ParticleField.tsx` 负责“粒子怎么靠过去、怎么晃、怎么响应鼠标”
3. 结构层
   `ConnectionLines.tsx` 负责“哪些点之间连线”
4. 风格层
   `shaders.ts` + `PostProcessing.tsx` + `usePlexusTheme.ts` 负责“看起来像什么气质”

这套分层很好，后续迭代不需要全部推翻。

## 14. 推荐的修改迭代方案

下面给你一套更实用的迭代路径。

### 方案一：低风险品牌化改造

目标：

- 保留当前技术架构
- 快速换成更贴近个人站的视觉图案

步骤：

1. 在 `plexus-shapes.ts` 新增 2 到 4 个自定义图案
2. 先只替换 `CODEX` 中的部分条目
3. 保留原有粒子数、连线和 bloom 参数
4. 本地观察图案是否容易“识别”
5. 再细调 `spread / jitter / lerpMul`

建议优先尝试：

- 名字首字母轮廓
- 山海/星辰主题抽象图
- 更现代的几何抽象 logo 图形

优点：

- 风险小
- 改动集中
- 很容易回退

### 方案二：增强首页叙事感

目标：

- 让图案变化和文案关系更强

步骤：

1. 继续沿用 `CODEX` 轮播机制
2. 让每个图案和一段 quote 有明确语义映射
3. 调整 `holdMs`，让复杂图形停留更久
4. 为特定图案设置不同的 `spin` 和 `jitter`

可以进一步考虑：

- 某些图案更稳，表达沉静
- 某些图案更活，表达探索
- 最后一个图案作为“站点签名图形”

### 方案三：视觉风格升级

目标：

- 保留点线结构，但进一步提高质感

建议改动：

1. 调整 `waveEnergy`，让脉冲传播更有方向性
2. 给线增加更细致的衰减和颜色分段
3. 给粒子增加中心高亮和边缘色温差
4. 精调 bloom，避免一味发糊

这类改动主要集中在：

- `shaders.ts`
- `usePlexusTheme.ts`
- `PostProcessing.tsx`

### 方案四：性能优先迭代

如果后面你发现某些设备掉帧，可以按这个顺序优化：

1. 降低 `particleCount`
2. 降低 `MAX_CONNECTIONS`
3. 缩小 `CONNECTION_DIST`
4. 降低 bloom 强度
5. 减少图案切换频率

当前实现里，最重的通常不是点本身，而是“每帧计算连线”。

## 15. 新图案接入模板

如果你后面要自己加图案，最小模板可以参考这个结构：

```ts
function generateMyShape(n: number): Point3D[] {
  const pts: Point3D[] = [];

  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    pts.push({
      x: Math.cos(t),
      y: Math.sin(t),
      z: Math.sin(t * 2) * 0.2,
    });
  }

  return pts;
}

const myShape: ShapeConfig = {
  generate: generateMyShape,
  spinX: 0.02,
  spinY: 0.04,
  spinZ: 0.08,
  spread: 1.1,
  jitter: 0.8,
  lerpMul: 1.0,
};
```

然后加进：

```ts
export const CODEX = [
  ...,
  {
    shape: myShape,
    quote: 'YOUR TEXT',
    author: 'YOUR AUTHOR',
    holdMs: 10000,
  },
];
```

## 16. 如果你要做“指定轮廓图案”，推荐做法

如果你想把图案改成：

- 字母
- logo
- 特定图标
- 中文字轮廓

推荐思路不是手写大量坐标，而是：

1. 先把轮廓抽象成若干路径点
2. 用 `sampleAlongPath3D` 或 `sampleMultiPath3D` 均匀采样
3. 最后 `normalize3D`

这也是当前 `Faravahar`、`Heptagram`、`Flower of Life` 等图案所采用的思路。

如果轮廓复杂，后续还可以继续升级为：

- 从 SVG path 采样点
- 再转成 `Point3D[]`

这是非常自然的一步演进。

## 17. 建议你优先关注的改动点

如果你的目标是“我想自己改出想要的图案”，优先看这几个文件：

- `src/components/ui/plexus-shapes.ts`
- `src/components/ui/plexus-webgl/ParticleField.tsx`
- `src/components/ui/plexus-webgl/ConnectionLines.tsx`

其中最优先的是：

- `plexus-shapes.ts`

因为它决定了最终“像什么”。

## 18. 最终结论

可以调整，而且当前项目结构对“改图案”这件事非常友好。

最核心的结论有三条：

1. 当前绘制并不是直接画固定模型，而是“粒子追逐目标点阵”
2. 图案控制中心在 `src/components/ui/plexus-shapes.ts`
3. 如果只是想改成别的图案，完全不需要重写 Three.js 架构

## 19. 后续可执行建议

如果下一步要实际落地，我建议按这个顺序推进：

1. 先选 1 个你真正想要的图案
2. 先在 `plexus-shapes.ts` 做最小接入
3. 调 `spread / jitter / lerpMul`
4. 再看是否要调整连线密度和 bloom
5. 最后决定是否保留多图案轮播

如果你愿意，下一步我可以直接继续帮你做其中一种：

- 新增一个自定义图案到 `plexus-shapes.ts`
- 把背景改成固定单一图案，不再轮播
- 帮你设计一套更适合个人站的图案序列
- 进一步把 SVG/logo 轮廓接进这套粒子系统
