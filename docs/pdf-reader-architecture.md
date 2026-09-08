# PDF Reader Architecture & Implementation Guide

本文档记录 imiles.me 站点的 PDF 查看与交互能力设计方案、技术选型及部署注意事项。

---

## 1. 设计定位与使用流程

针对技术博客、论文引用、白皮书展示及作品简历展示场景，本系统采用 **“轻量正文触发 + 独立沉浸式全功能阅读”** 的两段式设计：

```
[ MDX 博客正文 ]
   ├── <PDFLink />  (行内徽标引用链接)
   └── <PDFCard />  (块级文档下载与预览卡片)
           │
           │  点击跳转 (target="_blank")
           ▼
[ /pdf 独立全屏阅读器 ]
   ├── URL 规范: /pdf?src=/docs/paper.pdf&title=Paper%20Title
   ├── 布局: 无全站 Header/Footer 干扰的桌面级全屏应用视口
   ├── 核心功能:
   │    ├── 顶部工具栏 (缩放 / 翻页 / 视图切换 / 完整文档下载)
   │    ├── 折叠侧边栏 (📑大纲目录 / 🖼️页面缩略图 / 🔍全文搜索高亮)
   │    └── 双视口模式 (垂直连续虚拟滚动流 / 单页翻页排版)
   └── 底层引擎: 基于 pdfjs-dist 的 React 19 客户端岛屿组件
```

---

## 2. 核心组件与目录规划

```
src/
  components/
    pdf/
      # 正文轻量级触发组件 (零 Heavy JS，不阻塞主站加载)
      PDFCard.tsx              # 块级文档下载与跳转阅读卡片
      PDFLink.tsx              # 行内带图标的引用链接组件
      
      # 独立阅读器体系 (React 19 Island, 仅在 /pdf 页面水合)
      StandalonePDFReader.tsx  # 阅读器顶层控制器
      PDFToolbar.tsx           # 顶部毛玻璃操作栏
      PDFSidebar.tsx           # 侧边栏容器 (大纲 / 缩略图 / 全文搜索)
      PDFVirtualViewport.tsx   # 连续虚拟滚动主画布视口
      PDFSinglePageViewport.tsx# 单页模式画布视口
      
  hooks/
    usePDFDocument.ts          # 文档加载、元信息提取、大纲树解析
    usePDFSearch.ts            # 全文检索索引与关键词高亮
    usePDFShortcuts.ts         # 桌面端快捷键监听 (翻页、搜索、缩放)

  pages/
    pdf/
      index.astro              # /pdf 沉浸式阅读器路由 (client:only="react")

public/
  vendor/
    pdfjs/
      pdf.worker.min.mjs       # 本地静态托管的 PDF.js Worker 文件
      cmaps/                   # CJK 中文字符集映射表 (防止中文乱码)
```

---

## 3. 关键特性与交互规范

### 3.1 视口模式 (Viewport Modes)
1. **连续虚拟滚动流 (Continuous Scroll, 默认)**：
   - 纵向排布所有页面。
   - 利用 `IntersectionObserver` 仅渲染可视区前后 1 页的 Canvas，离开可视区域后销毁并释放显存，保证数十页乃至上百页的长文档丝滑流畅。
2. **单页翻页模式 (Single Page Mode)**：
   - 视口固定显示单页，支持左右按键切换或点击翻页，适合幻灯片（Slide decks）。

### 3.2 护眼与暗黑模式 (Dark / Paper Mode)
提供 3 档滤镜实时切换：
- **原始色彩 (Default)**：保持 PDF 原始白底和彩色插图保真度。
- **护眼深色 (Dark Mode)**：智能反转色彩（黑底白字，`filter: invert(0.9) hue-rotate(180deg)`），适合深夜长文阅读。
- **羊皮纸暖色 (Sepia Mode)**：柔和复古暖色调，缓解视觉疲劳。

### 3.3 全文检索与大纲 (Search & Outline)
- **大纲 (Bookmarks)**：自动提取 PDF 树形目录结构，点击精准滚动到目标页。
- **缩略图 (Thumbnails)**：低分辨率微缩排版，提供全局感知。
- **搜索 (Search)**：遍历各页 TextLayer 提取纯文本索引，展示匹配段落摘要，支持 `Next / Prev` 快速跳转与关键词高亮。

### 3.4 快捷键支持
- `PageDown` / `J`：下一页
- `PageUp` / `K`：上一页
- `Cmd / Ctrl + F`：呼出搜索侧边栏并聚焦输入框
- `+` / `-`：放大 / 缩小
- `0`：自适应宽度 (Fit Width)
- `Esc`：关闭侧边栏 / 退出搜索

---

## 4. Cloudflare 部署与 SSR 避坑指南

针对当前站点的 **Astro SSR + Cloudflare Workers (`adapter: cloudflare()` + `output: 'server'`)** 架构，严格遵循以下规则：

1. **必须使用 `client:only="react"`**：
   在 `src/pages/pdf/index.astro` 中引入 `StandalonePDFReader` 时，绝不能使用 `client:load`。因为 `pdfjs-dist` 依赖浏览器 DOM 全局对象（`window`, `document`, `DOMMatrix`），在 Cloudflare 边缘环境预渲染会导致 SSR 崩溃。
2. **Worker 与 CMap 本地静态化**：
   将 `pdf.worker.min.mjs` 及 `cmaps/` 统一存放在 `public/vendor/pdfjs/` 下，使用绝对根路径 `/vendor/pdfjs/...` 进行引用，避免不同路由层级相对路径失效或受限于外部 CDN 连通性。
3. **中文字体完整解析**：
   初始化 `pdfjsLib.getDocument` 时必须配置 `cMapUrl: '/vendor/pdfjs/cmaps/'` 与 `cMapPacked: true`，杜绝中文 PDF 渲染为豆腐块或乱码。
