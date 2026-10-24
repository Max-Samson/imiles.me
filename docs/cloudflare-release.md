# Cloudflare 构建与条件 D1 发布

当前继续使用一个 Cloudflare Worker，不拆分前后台应用。GitHub 只做 CI，原有 GitHub 自动部署 workflow 已移除，避免两个发布入口竞争。**本文件不代表线上设置已变更。**

## CI 规则

- PR 和 main/master 的 push 执行 CI；最小 `contents: read` 权限，不提供生产凭据。
- Node 固定为 `.nvmrc` 的 24.22.1，pnpm 固定为 packageManager 的 11.13.1。
- 质量门禁：Biome、格式、发布规则模拟测试、图标/模块边界测试。
- 服务端门禁：Astro 与服务端类型检查、Drizzle 元数据检查、本地 D1/KV 测试。测试显式 `remoteBindings: false`、不持久化；并发限制为 2。
- 通过后再做生产构建；构建检查禁止 Three.js、Pageel/MDXEditor 或后台 React UI 回到 SSR 图。
- CI 上传构建产物和依赖审计摘要，不部署、不执行远程 D1。建议在 GitHub 分支保护中将这三个 job 设置为必需检查；仓库文件不能代替线上分支保护设置。

## 纯构建

```sh
pnpm build
```

脚本按原顺序生成 llms、构建 Astro、生成 `.assetsignore`。未显式指定 Node 堆限制时默认 4096 MiB；显式的 NODE_OPTIONS 会保留。构建不连接远程 D1，不运行 schema push、迁移或业务数据导入。

额外生成 `.astro/build-server-audit.json`、`.astro/build-client-audit.json` 和 `.astro/release-build.json`；这些在静态产物目录之外。最后一个文件绑定构建提交和整个 dist 摘要，发布时防止错用旧产物。

## Cloudflare 需要人工配置的入口

- 构建命令：`pnpm build`
- **生产部署命令**：`pnpm release:cf`
- 非生产分支不能使用这个生产发布命令；继续使用平台预览功能或关闭非生产自动发布。
- 保持只有一个生产发布入口，并将生产发布串行化。脚本会检查生产版本是否变化，但乐观检查不是分布式锁，不能防止两个完全同时的发布。
- 所需 Cloudflare 权限由使用者在平台配置；脚本交给 Wrangler 认证，不自行读取、输出或管理认证材料。

`pnpm run deploy` 为本地完整入口：先纯构建，再执行同一个 `release:cf`。发布要求源码已提交且工作区干净。本次开发中的未提交修改不能拿来执行真实发布。

## 生产提交基线

脚本读取当前唯一 100% 流量的 Worker 部署，并从该版本标签 `git-<完整40位SHA>` 获取基线。后续部署自动写入新标签；失败构建不会推进基线，也不会错用 HEAD^ 而漏掉上次失败提交的 SQL。灰度多版本或无法识别的输出一律停止。

首次接入：旧版本没有标签，需要确认当前生产实际对应的提交，然后显式传入完整 SHA：

```sh
pnpm release:plan --base <当前生产完整提交SHA>
pnpm release:cf --base <当前生产完整提交SHA>
```

不要猜测基线，不要直接填 HEAD。第一次成功后删除临时 `--base` 参数，后续依靠生产标签；已存在有效标签时不能用参数覆盖不同基线。历史被清理、标签不可见或生产版本不在 Wrangler 返回的版本列表时会停止，需人工核验，不能降级为“无 SQL”。浅克隆只会补全 Git 历史。

## SQL 门禁

只监测 `drizzle/migrations` 顶层且符合现有编号规则的 `.sql`。meta JSON、普通文章、UI、其他目录 SQL 不触发远程 D1 调用。

- 无迁移 SQL 变更：**不 list、不 apply**，正常部署已有产物。
- 新增 SQL：Wrangler 查询 pending，核对全部 pending 是否属于本次新增范围，读取并审计 SQL。
- 已入生产提交基线的 SQL 不允许修改、删除或重命名。修改数据库结构需要新增迁移文件，不能指望 Wrangler 重放旧文件。
- DROP/RENAME/DELETE 等保守筛查命中时停止，走单独审查；未命中也不等于 SQL 已被证明安全。
- 非破坏性 pending 也需要明确批准：计划摘要绑定数据库、配置、生产/目标提交、文件名和内容摘要。
- 未配置测试数据库，不接受 `--env test`，不回退生产库。

计划命令：

```sh
pnpm release:plan
```

**计划不是完全离线命令**：它读取部署元数据；有 SQL 变化时会运行 D1 migrations list。Wrangler 的 list 在首次使用时可能初始化迁移跟踪表，因此本次实现验证全部使用模拟 runner，没有执行真实生产计划。

审查日志中的计划后，将相同摘要传入生产部署命令：

```sh
pnpm release:cf --approve <64位计划摘要>
```

在 Cloudflare 自动发布中，新增迁移的首次运行会输出计划并停止，审核后可以临时将同一 `--approve` 参数加入部署命令后重新运行；没有 SQL 的日常提交不需批准。每次批准对应固定提交，不能当作永久允许所有未来迁移的开关。默认 Wrangler deploy 不能绕过此门禁继续保留在另一条自动发布路径。

实际顺序：纯构建完成 → SQL 差异检测 → 必要时查询/批准/迁移/复核 → 部署同一产物 → 核验生产提交标签。构建失败不会改远程数据库；迁移失败不部署新代码。迁移必须兼容旧代码仍运行的窗口，破坏性变更使用 expand-contract 分期发布。

超时只表示本地无法确认结果，远程操作可能已经执行。脚本不会自动重试 apply/deploy；应先人工检查状态。D1 单个失败迁移的回滚不代表之前成功的迁移也回滚，Worker 回滚也不会自动回滚数据库。

## 当前边界与限制

- WebGL 仅在浏览器挂载，Hero 文字保留 SSR，首次客户端渲染与服务端一致。
- 公开页面使用只读内容仓库和轻量 HTML TOC；管理仓库复用读方法，保留发布/归档/删除行为。
- 后台 API 仍属于同一个 Worker，因此 Markdown/KaTeX、MDX 校验和存储依赖仍然需要部署；模块拆分不能冒充彻底移除后台。
- 保留静态文章源回退、Git 发布兼容适配器、鉴权、幂等与未知结果对账，不在本次优化中删除功能。
- 无 SQL 时零 D1 查询意味着不顺便检测人为 schema drift；需要单独的人工核验/恢复流程。
- 当前旧的 `db:migrate:remote` 是明确的人工运维命令，不应放入自动构建；自动发布必须使用上述门禁。

## 本轮发现的既有类型检查债务

Node 24.22.1 下，原始 b74542d 与优化版本的全量 astro check 都在输出工作台类型错误后触及 4 GiB 堆上限；优化版在中止前没有新增诊断。提高到 6 GiB 也未解决全量检查问题。工作台存在 type-only import、可空名称和联合类型等既有错误；聚焦 UI 的 tsc 另有 5 个原有 PDF API/属性错误，前后对照一致。

因此本轮不能称“所有 CI 已通过”。CI 保持严格，不使用 continue-on-error 或删除类型门禁掩盖这些问题；需要后续单独修复这批类型债务后再把 CI 作为正式发布前置条件。服务端类型检查、Drizzle 元数据、123 项测试、Biome/格式及 2 GiB 生产构建已在本地验证通过。
