# Cloudflare 构建与条件 D1 发布

当前继续使用一个 Cloudflare Worker，不拆分前后台应用。GitHub 只做 CI，原有 GitHub 自动部署 workflow 已移除，避免两个发布入口竞争。**本文件不代表线上设置已变更。**

## CI 规则

- Cloudflare 不会仅因 GitHub 配置了 CI 就自动等待其通过；关键检查需接入生产发布链路或平台等待。PR 和 main/master 的 push 执行 CI；最小 `contents: read` 权限，不提供生产凭据。
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
- 保持只有一个生产发布入口，并将从写库到部署完成串行化；不取消正在写库的任务。脚本的版本复核不是分布式锁，不能防止两个完全同时的发布。平台串行未核实前不得启用自动迁移生产入口；本次未修改线上并发设置，也未新增锁服务/锁表。
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

## SQL 新增/修改条件触发与策略

只监测 `drizzle/migrations` 顶层且符合现有编号规则的 `.sql`。meta JSON、普通文章、UI、其他目录 SQL 不触发远程迁移。所有生产发布会做只读结构就绪查询，防止历史漏迁移再次漏检。

- 无迁移 SQL 变更：只读检查数据库结构，**不 list、不 apply**；结构就绪后才部署已有产物。
- 新增或修改 SQL：Wrangler 查询完整 pending，核对全部 pending 是否属于本次新增/修改范围，读取并审计全部待执行 SQL。普通文章、UI/TS 或仅 meta JSON 修改不触发 list/apply。
- 修改 SQL 仅在文件仍为远程 pending 时允许进入校验；若不在 pending，则报 D1_APPLIED_MIGRATION_CHANGED，必须新增向前迁移。删除或重命名仍拒绝。D1 文件名账本不是执行内容哈希，不能重放已执行旧文件。
- DROP/RENAME/DELETE 等保守筛查命中时停止，走单独审查；未命中也不等于 SQL 已被证明安全。
- 自动范围的兼容 pending 无需逐次批准；超出自动范围或显式 reconcile 仍需 --approve。计划摘要同时绑定执行策略、数据库、配置、生产/目标提交、文件与内容，自动执行前仍复核 pending、SQL、策略和生产状态。
- 未配置测试数据库，不接受 `--env test`，不回退生产库。

计划命令：

```sh
pnpm release:plan
```

**计划不是完全离线命令**：它读取部署元数据并执行只读结构查询；有 SQL 变化或显式历史补齐时会运行 D1 migrations list。Wrangler 的 list 在首次使用时可能初始化迁移跟踪表，远程发布命令仅使用模拟 runner 验证，没有执行真实生产计划；另有隔离的本地 SQLite / D1 仿真器回归。

仅对 execution: approval-required 的计划，在审查完整 SQL 后将本次摘要传入生产部署命令；兼容自动计划无需该参数：

```sh
pnpm release:cf --approve <64位计划摘要>
```

在 Cloudflare 自动发布中，SQL 新增或修改时，符合自动子集的迁移以 `execution: automatic` 直接执行后部署；其他迁移输出 `execution: approval-required` 并在未批准时停止。审查后可临时带本次 --approve 重跑，不能永久保留旧摘要；即使自动计划收到旧摘要也会拒绝。无 SQL 新增/修改不 list、不 apply，不自动补历史。默认 Wrangler deploy 不能作为另一条生产入口。

实际顺序：纯构建完成 → SQL 差异检测与只读结构检查 → 必要时查询/批准/迁移 → 再查结构 → 部署同一产物 → 核验生产提交标签。构建失败不会改远程数据库；迁移失败不部署新代码。迁移必须兼容旧代码仍运行的窗口，破坏性变更使用 expand-contract 分期发布。

超时只表示本地无法确认结果，远程操作可能已经执行。脚本不会自动重试 apply/deploy；应先人工检查状态。D1 单个失败迁移的回滚不代表之前成功的迁移也回滚，Worker 回滚也不会自动回滚数据库。

## 自动 SQL 子集

自动策略是独立的词法/有限语法解析，不是“没匹配到 DROP 正则就安全”：

- 简单 CREATE TABLE：TEXT/INTEGER/REAL/BLOB/NUMERIC 列；允许列级 PRIMARY KEY、NOT NULL、字面量或 NULL 默认值。FK/CHECK/UNIQUE/表级约束、IF NOT EXISTS、虚拟表、CREATE AS 均不自动。
- 普通非唯一 CREATE INDEX：仅简单列名，可选 ASC/DESC；表达式和 WHERE 不自动。
- ALTER TABLE ADD [COLUMN]：仅可空列，无回填，默认值仅允许 NULL。
- 拒绝自动使用 sqlite_* 与默认账本 d1_migrations；多条语句逐条检查。未知符号、引号/注释异常不能自动执行。

唯一索引、复杂约束、INSERT/UPDATE、未知语句等进入人工范围；DROP/RENAME/DELETE 等原审计拒绝项不能用 --approve 绕过。自动子集不是性能、业务兼容或所有 D1 限制的证明，需隔离升级测试。现有0005含唯一索引、FK/CHECK等，因此不会自动认证为安全；guardian 表示数据库已更新，不能盲目重放0005。

修改未执行 SQL 时必须同步核对 Drizzle journal/snapshot，不能只改 SQL。新增 SQL 已执行而 deploy 失败，重跑核验 pending 后不重复 apply。**修改旧 pending 文件的特殊边界**：迁移成功但 deploy 失败时，生产 Git 标签仍可能对应旧内容，而 D1 默认账本只有文件名；再次发布会按“已执行 SQL 被修改”停止，需人工核验并恢复可信发布基线，不会把文件名冒充内容校验和。本次不新增远程内容账本。

自动流程不是通过内部回传 --approve 冒充人工审批，摘要仍绑定当前策略与内容。普通无 SQL diff 发布只有只读结构检查，不查 pending、不写库；缺结构时提示显式人工 reconcile。

## 当前边界与限制

- WebGL 仅在浏览器挂载，Hero 文字保留 SSR，首次客户端渲染与服务端一致。
- 公开页面使用只读内容仓库和轻量 HTML TOC；管理仓库复用读方法，保留发布/归档/删除行为。
- 后台 API 仍属于同一个 Worker，因此 Markdown/KaTeX、MDX 校验和存储依赖仍然需要部署；模块拆分不能冒充彻底移除后台。
- 保留静态文章源回退、Git 发布兼容适配器、鉴权、幂等与未知结果对账，不在本次优化中删除功能。
- 结构检查覆盖必需表、列名称/类型/非空属性和索引名称/唯一性/部分索引标志；不是数据、CHECK/外键表达式或索引列定义的完整一致性证明。不会自动修改结构或迁移记录。
- 当前旧的 `db:migrate:remote` 是明确的人工运维命令，不应放入自动构建；自动发布必须使用上述门禁。

## 历史漏迁移与首次接入

只有 Git SQL 差异不足以证明生产数据库完整：迁移文件可能已随历史代码上线，却一直没有在远程执行。现在每次发布均查询 `sqlite_master` 与只读 PRAGMA 元数据，不读取文章、用户或认证记录，不初始化迁移记录表。表名与列/索引要求从最终 Drizzle 快照产生；CI 另核对当前 schema 源码与快照，并在本地 D1 复现缺表/补齐后的读取。

结构缺失时普通发布停止，即使本次无 SQL diff。显式历史补齐流程如下（需源码已提交、产物匹配；首次旧部署无标签时仍需附带已核实的 `--base`）：

```sh
# 只生成计划：不 apply、不 deploy。仍会查询远程结构和迁移记录。
pnpm release:plan --reconcile-d1

# 审查全部 pending 对应的 SQL 后，使用本次计划的摘要批准。
pnpm release:cf --reconcile-d1 --approve <64位计划摘要>
```

`--reconcile-d1` 即使全部 SQL 属于兼容子集也强制人工审批，本身不授权写入。只允许当前受版本控制、与 journal 一致的已知迁移；未知远程文件、破坏性 SQL、未批准、清单变化、文件变化、生产版本变化或迁移后结构仍缺失均停止。批准绑定生产/目标提交、补齐模式、SQL 摘要、整套结构要求和 Wrangler 配置摘要。CLI 通过 `DB` 逻辑绑定定位 UUID，不依赖控制台展示名称。

如果迁移记录已经标为执行、实际表却缺失，不会删除记录或重跑历史 SQL，需人工核验并恢复。若记录未初始化但部分表已经存在，先核对实际表与执行记录；不要直接批准可能重复建表的 pending 清单。超时或部分迁移失败仍需先查实际结果，不盲目重试。

历史诊断曾看到仅有 friend_links 的数据库截图；guardian 后续已表示更新数据库并展示 cms_document_revisions，不能继续假定当前缺表或重复应用0005。实际 backend 列、完整结构、迁移账本与线上功能仍需核验。若 CF 仍用默认 `wrangler deploy`，会绕过此脚本，应在另获授权并确认串行后接入唯一生产入口。GitHub CI 不持有生产权限，不在 PR 或每次检查时同步远程数据库。

## 全量类型检查修复

根配置原先 `include: ["**/*"]` 把 `public/vendor/pdfjs/pdf.worker.min.mjs` 等复制的第三方静态代码也纳入检查。逐文件检查确认内存耗尽发生在压缩 Worker；现在仅将 `public/vendor` 加入 exclude，保留自有 public/sw.js、全部 src 与完整 Pageel 工作台检查。没有修改失败级别、隐藏类型错误、禁用严格检查或使用 continue-on-error。

同时修复 type-only imports、匿名 MDX 片段、发布错误码/字段快照契约、后台初始路由、Turnstile Promise、导航计时器、PDF.js 6 参数/页码回调、首页动态模板注释。Dashboard 保持宿主既有“仅文章列表”的行为，不重新开放不可达的上游管理页面。

CI 仍使用 Node 24.22.1 / pnpm 11.13.1；pnpm/action-setup 更新到 Node24 运行时的 v6，setup-node 使用 v7，runner 固定 ubuntu-24.04，避免无关的弃用警告与 ubuntu-latest 镜像漂移。完整检查继续使用原始 `astro check` 命令。
