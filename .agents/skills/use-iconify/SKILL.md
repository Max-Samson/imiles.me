---
name: use-iconify
description: 给项目添加 Iconify(iconify.design)图标的完整流程。当用户提到"使用icon"/"添加图标"/"补充图标"/"图标库"或要求往 src/components/article/TechSkillsCloud.tsx 技术栈图标云或项目其他任何组件里加图标时使用。
---

# 使用 Iconify 图标

本项目图标运行时**只有一个库**:`@iconify/react`。`simple-icons`、`devicon` 都只是 Iconify 内部的**集合前缀**(图标数据按集合名区分),`simple-icons` npm 包仅是离线提取图标路径和官方品牌色的数据源,不是第二个运行时库。

## 架构

```
运行时渲染:  @iconify/react 的 <Icon /> 组件
数据文件(离线打包,不调 Iconify API):
  src/data/tech-icons.json   simple-icons 子集 + 官方品牌色
  src/data/java-icon.json    devicon 集合的 java 图标(内嵌颜色,无 colors 字段)
目标组件:
  src/components/article/TechSkillsCloud.tsx  技术栈图标云(STACK 列表驱动)
  src/registry/magicui/icon-cloud.tsx          3D 球体渲染(本地魔改:600×600、图标 64px、球半径 180)
```

数据文件格式(Iconify JSON 子集):
```json
{
  "prefix": "simple-icons",
  "width": 24,
  "height": 24,
  "icons": { "<slug>": { "body": "<path fill=\"currentColor\" d=\"...\"/>" } },
  "colors": { "<slug>": "#品牌hex" }
}
```

## 场景 A — 给 TechSkillsCloud 添加 simple-icons 图标(最常见)

**第 1 步:确认图标在 Iconify 里存在**
```bash
curl "https://api.iconify.design/simple-icons.json?icons=<slug>"
```
返回 `"icons":{"<slug>":{...}}` 即存在。**不存在则不显示**(项目规则:图标库没有的暂不显示),或考虑换其他集合。

**第 2 步:把图标数据和品牌色写进 `src/data/tech-icons.json`**(自动从 `simple-icons` npm 包取 path + hex,勿手抄)
```bash
node -e "
const fs = require('fs');
const si = require('simple-icons');
const slug = process.argv[1];
const icon = si['si' + slug.charAt(0).toUpperCase() + slug.slice(1)];
if (!icon) { console.log('NOT in simple-icons npm:', slug); process.exit(1); }
const t = JSON.parse(fs.readFileSync('src/data/tech-icons.json', 'utf8'));
t.icons[slug] = { body: '<path fill=\"currentColor\" d=\"' + icon.path + '\"/>' };
t.colors[slug] = '#' + icon.hex.toLowerCase();
fs.writeFileSync('src/data/tech-icons.json', JSON.stringify(t));
console.log('added', slug);
" <slug>
```

**第 3 步:STACK 数组加一行**(按技术分组放,见速查表)
```ts
{ name: '显示名', slug: '<slug>' },
```

完成。组件自动读 `tech-icons.json` 渲染,品牌色自动带上。

### npm 包比 Iconify 镜像旧的案例

`simple-icons` npm 包可能已移除某些 Iconify 镜像里仍有的图标(案例:`openai` 在 npm 包缺失、Iconify API 有)。此时 body 从 API 取,hex 从 simple-icons 历史或品牌手册补:
```bash
curl "https://api.iconify.design/simple-icons.json?icons=<slug>"
# 取返回的 icons.<slug>.body 写入 tech-icons.json;colors 手动补官方 hex
```

## 场景 B — 非 simple-icons 集合(如 Java 的 devicon)

1. 查可用性:`curl "https://api.iconify.design/<集合>.json?icons=<名>"`
2. 图标数据存成独立小 JSON(如 `src/data/java-icon.json`),prefix 用集合名;若 body 内嵌 fill 颜色则**不需要 colors 字段**
3. 组件里注册:`import javaIcon from '@/data/java-icon.json'` + `addCollection(javaIcon)`
4. STACK 用 `icon` 字段(替代 slug,无 slug 即不配置颜色,内嵌色自动显示):
```ts
{ name: 'Java', icon: 'devicon:java' },
```

## 场景 C — 项目其他位置使用(普通 React 组件)

```tsx
import { Icon, addCollection } from '@iconify/react';
import techIcons from '@/data/tech-icons.json';
addCollection(techIcons);

<Icon icon="simple-icons:react" width={24} height={24} color="#61dafb" />
```
- 复用 `src/data/*.json` 作为数据源(离线、不膨胀 bundle),不要运行时调 Iconify API。
- 普通场景(非 renderToString)**不需要 `ssr: true`**——那是 IconCloud 用 `renderToString` 序列化图标时才踩的坑。
- 颜色规则同项目:simple-icons 单色需显式 `color`(品牌 hex 查 `tech-icons.json` 的 colors);devicon 等彩色集合内嵌颜色、不用传。

## 关键坑

1. **IconCloud 场景必须 `ssr: true`**:`@iconify/react` 的 `Icon` 默认在 `useEffect` 里才加载图标数据,而 IconCloud 用 `renderToString` 把图标序列化成 SVG 画到 canvas——effect 不执行 → 渲染空 `<span>` → canvas 空白。加 `ssr: true` 让数据在渲染时直接解析。
2. **图标尺寸要显式 px**(IconCloud 场景):默认宽高是 `1em`,SVG 以 data-URI 独立加载时 `1em` = 16px → 图标极小。传 `width={100} height={100}`(离屏 canvas 64×64 按 0.64 缩放正好铺满)。
3. **图标缺失症状**:`Icon` 渲染空 `<span>`,canvas 对应位置无像素。检查 slug 拼写 + 第 1 步 API 确认。
4. **深色品牌色在暗背景上几乎不可见**:prisma `#2D3748`、mdx `#1B1F24`、markdown `#000000`。用户已确认保留品牌色;若需要可见性,单独提亮这几个 hex 或组件里加"亮度低于阈值自动提亮"。
5. **单数据源**:完整 simple-icons 集合约 3.7MB,只打包用到的子集到 `src/data/tech-icons.json`;不要在客户端 import 整个 `@iconify-json/simple-icons`。
6. **Biome**:`src/components/` 下自己的组件需过 `pnpm exec biome check`;`src/registry/magicui/` 的 registry 组件保持原格式(双引号无分号),不要全文件重排。

## 验证

1. `pnpm dev` → 打开博客页(如 `/blog/mils`)→ 点击 **Technical Skills** 标题 → 全屏图标云出现
2. 无视觉模型时用 canvas 像素级检查(品牌色 RGB 命中数):
```js
// 在浏览器 console 对 canvas 采样:
const d = canvas.getContext('2d').getImageData(0, 0, 600, 600).data;
// 按品牌色 RGB 附近容差统计命中像素,>0 即渲染成功
```
3. 回归检查:拖拽旋转后像素变化、Esc/遮罩/关闭按钮、MobileTOC 仍含该标题、控制台无新错误(仅 Highlighter 的 `<line>` transient 噪音属已知)。

## 已用图标速查表(2026-08-08,26 项)

| 显示名 | slug / icon | 品牌色 |
|---|---|---|
| Vue 3 | simple-icons:vuedotjs | #4fc08d |
| React | simple-icons:react | #61dafb |
| TypeScript | simple-icons:typescript | #3178c6 |
| Astro | simple-icons:astro | #bc52ee |
| Nuxt | simple-icons:nuxt | #00dc82 |
| Tailwind CSS | simple-icons:tailwindcss | #06b6d4 |
| UnoCSS | simple-icons:unocss | #333333 |
| Figma | simple-icons:figma | #f24e1e |
| Node.js | simple-icons:nodedotjs | #5fa04e |
| Go | simple-icons:go | #00add8 |
| Java | devicon:java | 内嵌色 |
| Cloudflare Workers | simple-icons:cloudflare | #f38020 |
| D1 / SQLite | simple-icons:sqlite | #003b57 |
| Drizzle ORM | simple-icons:drizzle | #c5f74f |
| Prisma | simple-icons:prisma | #2d3748 |
| LLM APIs | simple-icons:openai | #412991 |
| Cloudflare Queue | simple-icons:cloudflare | #f38020 |
| Stripe Checkout | simple-icons:stripe | #635bff |
| Google OAuth | simple-icons:google | #4285f4 |
| i18n (11 languages) | simple-icons:googletranslate | #4285f4 |
| Git | simple-icons:git | #f03c2e |
| Vite | simple-icons:vite | #9135ff |
| Webpack | simple-icons:webpack | #8dd6f9 |
| Wails | simple-icons:wails | #df0000 |
| Docker | simple-icons:docker | #2496ed |
| MDX | simple-icons:mdx | #1b1f24 |
| Markdown | simple-icons:markdown | #000000 |

已确认缺失、按规则不显示的:nitro、websocket、sse(simple-icons 无对应图标)。
