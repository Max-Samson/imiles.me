# Pageel workbench compatibility prototype

## Boundary

Vendored browser workbench from `pageel/pageel-cms` commit
`545483babb0258b9493dcc844856ff9326bd592d` (MIT; see LICENSE).
`upstream/` retains its original modules; `plugin-mdx/` and `plugin-types/`
come from the corresponding upstream packages. No upstream Astro server,
login endpoints, server session code or Vercel adapter is included.

This directory is excluded from root Biome formatting to preserve upstream
reviewability. Host-owned adapters in `src/` remain subject to normal checks.
The scoped tsconfig uses upstream-style type import elision; it does not relax
host TypeScript settings. Upstream UI is not represented as type-clean.

## Module ownership

| Module | Responsibility |
| --- | --- |
| `upstream/components`, `features`, `hooks` | Pageel list, properties, editor workspace |
| `plugin-mdx` | Upstream MDXEditor slot; official plugin configuration patches & realm insertion |
| `integration/jsx-descriptors.ts` | Site JSX descriptors using GenericJsxEditor; no custom parser |
| `integration/component-editing/` | Component registry, document components navigation, selection preservation & inspector |
| `src/lib/admin/pageel-adapter.ts` (host) | Pageel IGitService to existing admin JSON envelope |
| `src/server/admin/cms/config.ts` (host) | Read-only collection configuration |
| `policy.ts` (host) | Allowed operations and content paths |
| `repository.ts` (host) | Read-only GitHub Contents transport / development snapshot |
| `service.ts` (host) | Operation dispatch; no authentication assumptions |
| `routes.ts` (host) | Existing Access authorization, bounded body, REST boundary |
| `src/pages/admin/edit.astro` (host) | Same-Worker private document, route-only CSS |

## Deliberate phase boundary

There is NO write switch in this prototype. Browser and server both refuse
save, upload, rename, delete and configuration changes. No upstream write
endpoints exist. Trial edits are memory-only; the page states this explicitly.
Do not add a write switch until editor roundtrip and metadata fidelity gates
pass. Existing Git/local authoring remains the persistence workflow.

Without CMS credentials, `pnpm dev` uses a server-only read snapshot of the
current content. This requires the existing localhost development auth policy;
snapshot imports are eliminated in production builds. This is not a local
file writer. Production fails closed without explicit CMS read configuration.

Optional GitHub read mode uses runtime bindings `CMS_GITHUB_TOKEN`,
`CMS_GITHUB_REPO`, `CMS_GITHUB_BRANCH`; do not use public/build-time env values.
A token needs only read access for this phase. Never put production credentials
in a browser. No new D1/KV/R2 resources or Node deployment are required.

## Patch ledger

1. `upstream/services/proxyGitService.ts`: re-export host read adapter.
2. `upstream/hooks/useSessionRestore.ts`: existing admin identity initialization;
   no Pageel password, token input, global storage clearing or SaaS bridge.
3. `upstream/components/Dashboard.tsx`: expose article list only in prototype;
   settings/plugin management routes are not implemented.
4. `upstream/hooks/useConfigManager.ts`: remove global sessionStorage clearing.
5. `upstream/components/App.tsx`: diagnostic link remains in admin namespace.
6. `upstream/index.css`: limit Tailwind scan to workbench sources; only imported
   by dedicated edit page.
7. `plugin-mdx/MdxSlot.tsx`: official table, codeMirror, linkDialog, JSX plugins;
   immediate onChange (avoid upstream 300 ms unflushed edit loss).
8. `plugin-types/index.ts` + `PostDetailView.tsx`: report import errors, preserve
   error payload source, switch to upstream Source tab instead of partial body.
9. `integration/jsx-descriptors.ts`: descriptors for existing five JSX components;
   imported modules are never evaluated in the browser editor.

To upgrade, compare every patched path with the pinned upstream commit, keep
LICENSE, update UPSTREAM.json, then repeat content and Worker compatibility tests.
The root dependency lock pins MDXEditor 3.20.0 for this evaluation.


## Host UI pass (2026-10-22)

- `integration/workbench.css`, `labels.ts`, `zh.ts`: scoped typography, inherited
  admin light/dark theme, Chinese screen/toolbar text and metadata display labels.
- `Dashboard`: key the upstream PostList by collection ID to discard stale article,
  search and selection state on collection switches; remove duplicate editor heading.
- `PostDetailView`: collapsible properties, constrained writing width, explicit
  memory-only status; persistence actions disabled. Cover failures show a fallback.
- `PostList` / `CollectionPicker`: disable unavailable repository mutations;
  use pubDate for default date sorting. Server and adapter denials still apply.
- `utils/github` and MDX slot: same-origin public asset previews; no unimplemented
  upstream image proxy. This does not implement private repository media delivery.
- `Sidebar` / `SyncStatusBadge`: replace misleading sync and image-count status.
- `useSessionRestore`: use the site's existing favicon.ico.

Browser checks: actual Astro/Nuxt article images loaded (all five body images and
cover); switching an open blog article to Stories returns the correct two-story
list; properties collapse and restore; no horizontal overflow at 1280px.
These checks do not certify serialization, persistence, or full mobile support.


## 后台嵌入重构（2026-10-23）

当前主入口为 `index.ts` → `integration/components/EmbeddedWorkbench.tsx`。
宿主 `ArticlesAdmin` 通过 React.lazy 挂载工作台，注入已验证的 AdminSession
身份、PageelReadAdapter、主题及离开确认。不会运行上游 App/useSessionRestore，
不会显示第二套侧栏、账户菜单或覆盖 body class。

- `integration/components/CollectionToolbar.tsx`：项目集合工具栏。
- `integration/context.tsx`：主题、修改通知、离开确认的最小接口，不存正文。
- `integration/tailwind.css`：使用 @reference 和 @scope 生成局部 utilities，
  不重复注入 preflight；宿主基础样式来自原 AdminLayout。
- `integration/workbench.css`：内容布局、中文排版与主题适配。
- `upstream/Dashboard`：增加 embedded 参数；仍复用原初始化 hooks 和 PostList。
- `upstream/PostDetailView`：向宿主报告 dirty，返回列表前执行离开检查。
- `plugin-mdx/MdxSlot`：响应宿主主题；忽略初始归一化的 onChange 通知。

未保存修改保护覆盖后台路由、关闭当前标签、切换集合、返回列表和浏览器离开。
这是离开确认，不是持久化草稿或崩溃恢复。上游仍有补丁，并非完全未修改的源码；
升级时必须核对上述接缝及既有补丁台账。

验证：嵌入列表/详情、后台主题实时切换、返回友链后样式保持正常；原生确认框的
取消/确认分支尚未完成浏览器自动化验收，保护注册与清理已有单元测试。


## JSX 编辑体验与双栏滚动（2026-10-23）

- `integration/components/ContentJsxEditor.tsx` 包装官方 GenericJsxEditor。
  文字继续使用原生嵌套编辑器，行内组件用紧凑底纹/下划线表示。
- 禁用通用 JSX 属性弹窗，组件参数通过源码修改。原因：固定版本的
  GenericJsxEditor 会重新构造 attributes，无值 hydration 属性不在其回写值中。
  只对展示层传入空 props，原始 JSX descriptor 的导入和属性定义保持不变。
- 桌面正文/属性栏分别限定高度并独立滚动；小于 1024px 恢复单列滚动。
- 浏览器验证：正文 scrollTop 720 时右栏仍为 0；右栏滚到 428 后正文仍为 720。
- 真实 miles-zh 文章修改嵌套文字后，Source 中 client:load、action、color、
  PreviewLink 的 href 和 TechStackTerminal 的 profile 对象仍保留。测试文字已恢复。
  此单项验证不代表完整 MDX 或 frontmatter 保存保真验收通过。


## 文章编辑台与组件系统设计（2026-10-23）

组件配置以 `src/config/content-components.ts` 为唯一元数据真源，核心实现在 `integration/component-editing/`。整体架构由「右栏三栏结构」、「正文实例导航」、「选区与插入机制」、「组件参数配置」及「官方编辑器协同」组成。

```text
component-editing/
├── registry.ts               # 组件能力元数据（分类、支持级别、默认属性与摘要提取）
├── InspectorContext.tsx      # 右栏三栏状态总线（文章/组件库/当前组件切换与节点注册）
├── DocumentComponents.tsx    #「本文已用」组件树与正文定位导航
├── useDocumentComponents.ts  # 正文 AST/Markdown 实时解析（实例计数、深度与从属推导）
├── ComponentLibrary.tsx      #「组件库」搜索、分类卡片、微型示例与插入触发
├── ComponentProperties.tsx   #「当前组件」参数配置表单、莫兰迪色盘与只读保护
├── RegisteredJsxEditor.tsx   # MDXEditor 原生 JSX 渲染适配器（行内气泡/块级头部）
└── insertion.ts              # 选区记忆、恢复、集合隔离与 AST 载荷构建
```

### 1. 右栏三栏信息架构

右栏顶部提供 `文章 ｜ 组件库 ｜ 当前组件` 统一切换标签，内置图标和语义化指示器：

- **文章 (`article`)**：管理文章级 Frontmatter（封面图更换、标签、slug、发布日期等基础属性及补充字段）。
- **组件库 (`library`)**：集中解决「有哪些能用、当前用了哪些、如何插入」三大核心问题：
  - **搜索与分类**：即时关键字筛选，按「文字与链接」、「内容容器」、「展示组件」分组呈现。
  - **静态微型示例**：卡片内仅展示轻量静态示意（如 macOS 终端三色控制按钮、手绘高亮线、技能胶囊），严禁在侧边栏中加载 WebGL 动画或真实网络请求。
  - **支持程度提示**：每张卡片明确标识「可配置」或「需源码配置」，避免误导用户。
  - **集合约束隔离**：故事（Stories）属于纯文本 Markdown，列表自动显示安全警告并完全禁用插入操作。
- **当前组件 (`component`)**：展示当前正文选中节点的具体参数配置。正文中有选中组件时，标签旁带有蓝色脉冲指示点；面板提供「← 返回组件库」与未保存修改保护。

### 2. 「本文已用」正文导航与定位联动

- **实时状态派生**：通过 `useDocumentComponents(content)` 从当前编辑器正文字符串动态解析，随着用户的输入、删除和撤销实时联动，而非静态扫描文件 import。
- **易读摘要推导**：每个实例生成「组件名 · 实例内容摘要」（如 `高亮文字 · Miles`、`预览链接 · AskSoul.me`），而非重复的技术名称。
- **嵌套层级展示**：自动推导容器与内部组件的深度（如 ExploreCard 内部包含 Highlighter），以树形缩进箭头（`↳`）清晰呈现。
- **平滑定位与脉冲描边**：点击实例按钮后，正文平滑滚动至对应目标元素，并自动触发 `@keyframes cms-pulse-outline` 的 1.4s 蓝色脉冲描边，随后平滑切入「当前组件」面板。

### 3. 选区感知与防失焦插入流程

点击右侧侧栏通常会导致编辑器 `contentEditable` 失焦。为此在 `insertion.ts` 与 `plugin-mdx/MdxSlot.tsx` 协同实现了选区保护：

1. **选区记忆**：通过 `selectionchange` 实时拦截并持久化合法的 Range 与选中文本。
2. **选区恢复**：在插入动作触发时通过 `restoreEditorSelection()` 精确恢复光标位置。
3. **区分行内与块级插入**：
   - **行内组件 (Highlighter / PreviewLink)**：优先「选中文字 → 包裹效果」。若已选中文本，直接插入并包裹；若无选区，弹出快捷模态框要求输入显示文字后再插入，支持 Enter 确认与 Esc 取消。
   - **块级组件 (ExploreCard / TechSkillsCloud / TechStackTerminal)**：直接在光标所在段落位置插入独立 AST 块，插入后自动定位并切换至配置面板。

### 4. 当前组件参数配置与保护机制

- **根治侧栏空白 Bug**：废弃先前基于 `createPortal` 到未初始化 DOM 挂载点的机制，改为由 `RegisteredJsxEditor` 将 MDAST 节点及 `updateAttributes` 更新器直接注册到 `InspectorContext`，由侧边栏直接受控渲染，彻底杜绝白屏问题。
- **莫兰迪调色板**：高亮颜色选择器内置「樱粉 (#ffd1dc)、天蓝 (#87cefa)、薄荷 (#a7f3d0)、柠檬 (#fde68a)、紫薯 (#e9d5ff)」五组精致预设色块，支持一键点击切换。
- **只读保护提示**：当检测到 JSX 属性包含复杂 JavaScript 表达式、对象展开 (spread) 或受保护的动态覆写时，表单显示「只读保护」警示，禁止盲目覆盖，完整保留源码。
- **未应用修改保护**：表单维护 `dirty` 状态，点击「返回组件库」或切换组件前强制弹出二次确认，防止误操作丢失修改。

### 5. 官方 MDXEditor 插槽协同

- 通过 `@mdxeditor/editor` 官方 `realmPlugin` 将 `insertJsx$` 信号安全接入编辑台。
- 采用稳定 Ref 与闭包调度，确保 MDXEditor 的 plugins 列表保持引用稳定，彻底消除不必要的编辑器重新挂载。
- 块级组件自带卡片头部与「配置参数」按钮；行内组件悬浮时居中弹出微型操作胶囊（`.cms-component-select`），编辑交互直观优雅。

### 6. 测试与质量保证

- `tests/server/component-editing.test.ts`：覆盖正文组件解析、嵌套层级推导、摘要提取、集合插入门禁（Stories 严格禁止）、行内/块级 AST 载荷构建与注册表元数据校验。
- `tests/server/jsx-attributes.test.ts`：覆盖白名单字面量修改、表达式/spread 保护、安全字符串字段更新与节点注册保留。
- 全量 59 项服务端测试均在 CI 与本地闭环验证通过（`pnpm test:server`）。
