# 全站色彩体系设计规范 (`websites-color.md`)

本文档系统性梳理当前项目的色彩架构、品牌主色、环境光晕以及外部引入组件的色彩约定。

---

## 一、架构设计原则：保留外部引入组件原始特性（Zero Mutation）

根据项目组件分层约定（参考 `docs/ui.md` 与 `AGENTS.md`）：
- **`src/registry/`** 存放自外部（如 `react-bits`、`magicui`）引入的元组件；
- **核心准则**：**严禁修改引入的原始元组件源码，也不得通过强行 `!important` 破坏其内建的原始视觉特征**；
- 外部元组件（如 `src/registry/react-bits/ProfileCard.tsx`）保持与其官方版本 100% 一致（0 diff），完整保留其原汁原味的设计语言（如独特的全息渐变、双层深度光栅、内建发光与全息字符混合模式）。

---

## 二、基础系统色值表 (`src/styles/global.css`)

基于 OKLCH 规范定义的全局语义 Token：

| 语义变量 | 暗色模式 (Dark, 默认) | 浅色模式 (Light) | 用途说明 |
|---|---|---|---|
| `--background` | `oklch(0.145 0 0)` (~`#121214`) | `oklch(1 0 0)` (`#ffffff`) | 页面主背景 |
| `--foreground` | `oklch(0.985 0 0)` (~`#fcfcfc`) | `oklch(0.145 0 0)` (~`#171717`) | 页面主标题与正文字色 |
| `--card` | `oklch(0.205 0 0)` (~`#1e1e21`) | `oklch(1 0 0)` (`#ffffff`) | 卡片背景底色 |
| `--card-foreground` | `oklch(0.985 0 0)` | `oklch(0.145 0 0)` | 卡片内主文字 |
| `--border` | `oklch(1 0 0 / 10%)` | `oklch(0.922 0 0)` | 细边框与分割线 |
| `--muted` | `oklch(0.269 0 0)` (~`#2e2e33`) | `oklch(0.97 0 0)` | 标签、输入框微弱底色 |
| `--muted-foreground`| `oklch(0.708 0 0)` (~`#a1a1aa`) | `oklch(0.556 0 0)` | 次级文字、日期、描述 |
| `--accent` | `oklch(0.269 0 0)` | `oklch(0.97 0 0)` | 悬停强化底色 |
| `--ring` | `oklch(0.556 0 0)` | `oklch(0.708 0 0)` | 聚焦外发光环 |

---

## 三、站点核心品牌色彩 (`Tajik Heritage Palette`)

全站页面与自有组件严格收敛于以下品牌调色板：

| 色彩名称 | 变量名 / 官方定义 | 常用常量十六进制 | 视觉用途 |
|---|---|---|---|
| **品牌主色 (Brand Gold)** | `--brand` / `oklch(0.86 0.18 87)` | `#d4a958` / `#fbbf24` | 核心文字高光、LineSidebar 激活、荣誉徽章、脉冲提示 |
| **品牌副色 (Brand Green)** | `--brand-secondary` / `oklch(0.62 0.17 145)` | `#10b981` | 活跃状态指示（`--status-active`）、教育经历圆点、成功反馈 |
| **苍穹青灰 (Slate Cyan)** | 常量色值 `#83a9b9` | `#83a9b9` / `rgba(14, 165, 233)` | 博客发光边框双色混配（ShineBorder）、LightRays 贯穿环境光 |
| **警示绯红 (Destructive)** | `--destructive` / `oklch(0.6 0.22 29)` | `#ef4444` | 错误、终止、终端红点 |

---

## 四、ProfileCard 暖色默认配色与标准调用规范

`ProfileCard`（`src/registry/react-bits/ProfileCard.tsx`）是严格按原版保留的交互卡片，业务层通过 `src/components/common/ProfileCardMiles.tsx` 直接传参调用，**不篡改其内部实现**：

```tsx
import ProfileCard from '@/components/common/ProfileCard';

<ProfileCard
  name="Miles"
  title="Full-Stack Web Engineer"
  handle="imiles"
  status="Online"
  contactText="Contact Me"
  avatarUrl="/images/avatar.png"
  showUserInfo
  enableTilt={true}
  enableMobileTilt
  onContactClick={() => console.log('Contact clicked')}
  behindGlowColor="rgba(255, 196, 125, 0.72)"
  iconUrl="/assets/demo/iconpattern.png"
  behindGlowEnabled
  innerGradient="linear-gradient(145deg, #b8775599 0%, #e9ac7373 55%, #ffe0a85c 100%)"
/>
```

### 业务层暖色默认参数

业务包装层采用更明亮的暖陶色 → 蜜桃色 → 香槟金渐变，搭配杏金色后置光晕。通过公开参数设置配色，保留元组件内建全息反射与文字效果；调用方仍可覆盖这两个参数。

- **卡片底层全息渐变 (`innerGradient`)**：`linear-gradient(145deg, #b8775599 0%, #e9ac7373 55%, #ffe0a85c 100%)`
- **悬浮后置光晕 (`behindGlowColor`)**：`rgba(255, 196, 125, 0.72)`
- **全息光斑图案 (`iconUrl`)**：`/assets/demo/iconpattern.png`
- **头像展示**：自然采用原版 `mix-blend-mode: luminosity` 与三维视差浮动；
- **文字样式**：保留原版金属反光质感与层叠视差位移。

---

## 五、首页各屏视觉色彩对应图谱

| 屏次 | 模块名称 | 核心主导色与搭配 |
|---|---|---|
| **Screen 1** | **Hero 开场界域** (`hero-section`) | WebGL Plexus 金白光点 + 穿透光线（`rgba(251, 191, 36, 0.15)`） |
| **Screen 2** | **工程 & 作品** (`projects-section`) | 3D 轮播卡片边框 + 翡翠绿状态圆点（`--status-active`） + 品牌金类别徽章 |
| **Screen 3** | **成长轨迹** (`experience-section`) | 「认识我」交互弹窗 + 脊柱时间轴分色（工作=天蓝、荣誉=品牌金、教育=品牌绿） |
| **Screen 4** | **长文 & 思考** (`blog-section`) | ShineBorder 双色混配：`['#d4a958', '#83a9b9']`（品牌金 + 苍穹青） |
| **Screen 5** | **技术雷达** (`tech-section`) | 终端彩点（红、黄、绿） + 3D 交互球云高亮 |
| **Screen 6** | **数字花园** (`garden-section`) | 3D 浮动粒子星海（金光粒子 + 青蓝微粒） |
