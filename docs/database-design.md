# 数据库设计与迁移约定

当前使用 Cloudflare D1 + Drizzle ORM。业务表包含友链、CMS 草稿、已发布文章、图片元数据、发布/删除尝试及不可变修订快照。`drizzle/migrations/0000–0005` 与 schema、snapshot、journal 配套维护；以版本化文件为准，隔离本地验证不代表现有本地业务库或生产库已迁移。

## 命名与公共字段

- 表名使用 snake_case 复数，字段使用 snake_case；TypeScript 属性采用 camelCase。
- 普通索引命名 `idx_<table>_<fields>`，唯一索引命名 `uniq_<table>_<fields>`。
- 业务主键使用 `primaryKeyColumn(prefix)`，格式为业务前缀加完整 UUID（去掉连字符），保留 UUID 随机性。不可用主键难以猜测来替代授权。
- 仅追加日志等业务可按实际访问模式选择整数主键；不要把随机 ID 描述成 D1 避免写锁的机制。
- 时间戳统一使用毫秒数字：`integer` + `Date.now()`。不要与 Drizzle `timestamp_ms` 的 JavaScript Date 模式混用。
- 可修改业务表使用 `auditTimestamps()`；需要撤回/归档时再增加软删除列。
- 已有 CMS 迁移中的索引名称沿用 `cms_*` 前缀；上面的 `idx_` / `uniq_` 是后续新索引约定，不要求重命名已有索引。

```ts
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { auditTimestamps, primaryKeyColumn } from './common';

// 仅示例，并非已实现的业务表。
export const exampleItems = sqliteTable('example_items', {
  id: primaryKeyColumn('item'),
  slug: text('slug').notNull(),
  title: text('title').notNull(),
  ...auditTimestamps(),
}, (table) => [uniqueIndex('uniq_example_items_slug').on(table.slug)]);

export type ExampleItem = InferSelectModel<typeof exampleItems>;
export type NewExampleItem = InferInsertModel<typeof exampleItems>;
```

## 现存数据表数据字典：`friend_links`（友情链接系统）

### 1. 表概览与业务定位

- **对应 Schema**：`src/server/db/schema/friend-links.ts`
- **物理表名**：`friend_links`
- **业务定位**：持久化全站友情链接及访客自主申请，涵盖“提交申请 → 防重幂等 → Turnstile 人机验证 → 管理员审核 → 截图直存 S3 → 公开发布与隐藏”完整生命周期。

### 2. 字段明细表

| 字段名 (Column) | 物理类型 | TS 类型 | 主键 | 非空 | 默认值 | 业务含义与约束说明 |
| :--- | :--- | :--- | :---: | :---: | :---: | :--- |
| `id` | `TEXT` | `string` | ✅ | ✅ | 无 | 唯一主键，格式为 `fl_[32位随机十六进制]` |
| `name` | `TEXT` | `string` | ❌ | ❌ | `null` | 博客名称 / 站长称呼（1 ~ 50 字符，用于友链卡片主标题展示） |
| `submitted_url` | `TEXT` | `string` | ❌ | ✅ | 无 | 申请人原始填写的站点 URL（保留原始输入以便核对） |
| `canonical_url` | `TEXT` | `string` | ❌ | ✅ | 无 | 经协议正规化后的规范 HTTPS URL（剔除锚点/参数/尾随斜杠） |
| `description` | `TEXT` | `string` | ❌ | ✅ | 无 | 站点介绍与描述文案（限制 1 ~ 200 字符） |
| `contact_email` | `TEXT` | `string` | ❌ | ❌ | `null` | 申请人联系邮箱（3 ~ 254 字符，用于审核结果通知） |
| `status` | `TEXT` | `string` | ❌ | ✅ | `'pending'` | 链接状态：`'pending'`（待审）、`'active'`（已发布）、`'rejected'`（驳回）、`'hidden'`（暂时隐藏） |
| `screenshot_key` | `TEXT` | `string` | ❌ | ❌ | `null` | S3 对象存储中的封面截图文件 Key（如 `friend-links/screenshots/...`） |
| `screenshot_mime`| `TEXT` | `string` | ❌ | ❌ | `null` | 截图 MIME 类型：`image/png`、`image/jpeg`、`image/webp` |
| `screenshot_bytes`| `INTEGER`| `number` | ❌ | ❌ | `null` | 截图文件字节大小（上限 2MB = 2,097,152 字节） |
| `screenshot_sha256`| `TEXT` | `string` | ❌ | ❌ | `null` | 截图文件的 SHA-256 指纹（64位长），防内容篡改与重复存储 |
| `submission_key_hash` | `TEXT`| `string` | ❌ | ✅ | 无 | 客户端传来的 `Idempotency-Key` UUID 的 SHA-256 哈希，实现接口强幂等 |
| `submission_payload_hash` | `TEXT`| `string` | ❌ | ✅ | 无 | 提交内容快照哈希，防止同一 Key 对应不同内容篡改 |
| `version` | `INTEGER`| `number` | ❌ | ✅ | `1` | 乐观锁版本号（必须大于 0），用于管理员并发审核冲突控制 |
| `reviewed_by` | `TEXT` | `string` | ❌ | ❌ | `null` | 审核管理员标识 |
| `reviewed_at` | `INTEGER`| `number` | ❌ | ❌ | `null` | 审核完成时间戳（毫秒） |
| `published_at` | `INTEGER`| `number` | ❌ | ❌ | `null` | 首次公开上架时间戳（毫秒） |
| `updated_by` | `TEXT` | `string` | ❌ | ❌ | `null` | 最近修改该记录的操作人 |
| `created_at` | `INTEGER`| `number` | ❌ | ✅ | `Date.now()`| 记录创建时间戳（毫秒） |
| `updated_at` | `INTEGER`| `number` | ❌ | ✅ | `Date.now()`| 记录最后修改时间戳（毫秒） |

### 3. 索引与约束设计

| 约束 / 索引名称 | 类型 | 作用目标 | 设计理由与业务保障 |
| :--- | :--- | :--- | :--- |
| `friend_links_submission_key` | UNIQUE | `submission_key_hash` | **防止高并发重复提交**：同一幂等键绝不插入两条申请记录 |
| `friend_links_published_url` | PARTIAL UNIQUE | `canonical_url` (WHERE status IN ('active', 'hidden')) | **防止重复入驻**：对已上架或隐藏的友链，同一规范 URL 仅允许一条有效记录 |
| `friend_links_screenshot_key`| UNIQUE | `screenshot_key` | 确保同一张存储图片不被不同友链错误错位关联 |
| `friend_links_public_list` | INDEX | `status, published_at, id` | **公开列表极速分页**：前台 `/api/v1/friend-links` 仅拉取 active 友链，命中覆盖索引毫秒级返回 |
| `friend_links_admin_list` | INDEX | `status, created_at, id` | **管理端待审队列分页**：支持按状态与申请时间流快速过滤与审核 |
| `friend_links_url_history` | INDEX | `canonical_url, status` | 快速核验该 URL 的历史审核与拉黑状态 |
| `friend_links_name` | CHECK | `name` | 保证博客名称合法性：name 允许为空，非空时长度限制在 1 ~ 50 字符之间 |
| `friend_links_review` | CHECK | 多列逻辑校验 | 保证状态机一致性：pending 状态下禁止存在审核人/审核时间；非 pending 状态必须具备完整的审核轨迹 |
| `friend_links_publication`| CHECK | 多列逻辑校验 | 保证发布一致性：pending/rejected 状态下 published_at 必为 null；active/hidden 状态下必有发布时间 |
| `friend_links_image` | CHECK | 多列逻辑校验 | 保证图片元数据完整性：四项截图元数据要么全为空，要么全部合法填充且体积小于 2MB |

## CMS 工作草稿与仓库操作

Schema 位于 `src/server/db/schema/cms.ts`。D1 保存后台工作草稿、修订快照、发布和删除操作记录。当前 D1 原生发布模式将公开 Blog / Stories 写入 `cms_posts`，文件内容仍可作为静态回退；兼容的 Git 通道则提交 `content/blog/**/*.md[x]`、`content/stories/**/*.md`，需构建部署后才影响线上页面。`draft: true` 是文章 frontmatter 字段，不等于 `cms_drafts.status`。图片字节存于对象存储，元数据保存在 `cms_draft_assets`；上传与文章发布有独立的权限、大小及资源归属校验。

### `cms_drafts`：一轮可修订的工作草稿

一行记录一轮草稿。发布或废弃后保留该行作为历史；已发布文章再次编辑时创建新的活动草稿。新稿的 `base_blob_sha` 为空，基于仓库文章编辑时保存打开时的 Git blob SHA。

| 字段 | 类型 / 默认值 | 含义 |
| --- | --- | --- |
| `id` | `TEXT` 主键 | `cmd_` 前缀的业务 ID |
| `collection` | `TEXT` 非空 | `blog` 或 `stories` |
| `format` | `TEXT` 非空 | `md` 或 `mdx`；Stories 只允许 `md` |
| `lang` | `TEXT` 非空 | `en` 或 `zh` |
| `slug` | `TEXT` 非空 | 文件身份使用的 slug |
| `target_path` | `TEXT` 非空 | 固定仓库目标文件路径 |
| `public_path` | `TEXT` 非空 | 按集合、语言和 slug 解析的站点路径 |
| `source` | `TEXT` 非空 | 原始 MD/MDX 源文，包含 YAML frontmatter |
| `source_hash` | `TEXT` 非空 | 源文 UTF-8 字节的 SHA-256 十六进制摘要 |
| `source_bytes` | `INTEGER` 非空 | 源文 UTF-8 字节数，数据库约束为 1 至 1,048,576 |
| `base_blob_sha` | `TEXT` 可空 | 建立草稿时的仓库版本；发布成功后更新为结果 blob SHA |
| `revision` | `INTEGER` 非空，默认 `1` | 乐观并发修订号，每次成功保存加一 |
| `status` | `TEXT` 非空，默认 `active` | `active`、`published`、`discarded` |
| `title_cache` | `TEXT` 可空 | 列表摘要；解析失败时可为空，不替代源文标题 |
| `created_by` / `updated_by` | `TEXT` 非空 | 创建者与最近修改者标识 |
| `closed_at` | `INTEGER` 可空 | 发布或废弃时的毫秒时间戳 |
| `published_commit_sha` | `TEXT` 可空 | 发布完成时的 Git commit SHA；活动/废弃草稿必须为空 |
| `created_at` / `updated_at` | `INTEGER` 非空 | 毫秒时间戳，由 Drizzle 写入和更新 |

`cms_drafts_active_target` 与 `cms_drafts_active_public` 是部分唯一索引，只约束 `status='active'` 的 `target_path` 和 `public_path`，允许历史行保留。`cms_drafts_admin_list(status, updated_at, id)` 支持活动列表；`cms_drafts_path_history(target_path, created_at)` 支持同一文件的历史查找。CHECK 约束限定集合、格式、语言、状态、修订号、大小，并保证 `active` 无关闭信息、`published` 有关闭时间及提交 SHA、`discarded` 有关闭时间且无提交 SHA。路径合法性、`source_hash` 与实际源文是否相符仍由服务层保证，数据库 CHECK 不计算哈希。

普通保存以 `id + status='active' + revision` 为条件更新源文和修订号；零行命中返回 409。废弃也要求匹配修订号，并以 `NOT EXISTS` 拒绝仍有 `prepared`、`in_flight` 或 `unknown` 发布操作的草稿。列表查询不读取整篇 `source`。

### `cms_publication_attempts`：固定的发布意图

一行对应一次 `operation_id`。先保存待发布源文快照、目标路径及预期 blob SHA，再认领操作并向固定 Git 仓库提交。D1 与 GitHub 没有跨系统事务，网络结果不明时只用原操作 ID 对账。

| 字段 | 类型 / 默认值 | 含义 |
| --- | --- | --- |
| `operation_id` | `TEXT` 主键 | 幂等操作 ID；服务层要求 UUID |
| `draft_id` | `TEXT` 非空，外键 | 指向 `cms_drafts.id`，删除行为 `RESTRICT` |
| `draft_revision` | `INTEGER` 非空 | 发起时固定的草稿修订号，必须大于零 |
| `request_hash` | `TEXT` 非空 | 请求身份摘要，防止同一操作 ID 用于另一份意图 |
| `source_snapshot` | `TEXT` 可空 | 实际将提交的源文快照；当前创建操作时写入 |
| `source_hash` / `source_bytes` | `TEXT` / `INTEGER` 非空 | 快照的 SHA-256 与字节数；字节数限制 1 至 1,048,576 |
| `target_path` / `public_path` | `TEXT` 非空 | 发起时固定的仓库文件和站点路径 |
| `expected_blob_sha` | `TEXT` 可空 | 更新时的 Git 基准；新建文件时为空 |
| `status` | `TEXT` 非空，默认 `prepared` | `prepared`、`in_flight`、`unknown`、`committed`、`conflict`、`failed` |
| `result_blob_sha` / `result_commit_sha` | `TEXT` 可空 | 仅 `committed` 状态两者均非空 |
| `deployment_status` | `TEXT` 非空，默认 `unverified` | 固定 Deploy 工作流的核验状态；Git 提交成功时仍为未核实 |
| `deployment_ref` / `deployed_at` | `TEXT` / `INTEGER` 可空 | 已核验或待处理的工作流运行 ID、成功完成时间 |
| `error_code` | `TEXT` 可空 | 预留结构化错误码 |
| `created_by` | `TEXT` 非空 | 发起人标识 |
| `completed_at` | `INTEGER` 可空 | 得到确定结果时的毫秒时间戳 |
| `created_at` / `updated_at` | `INTEGER` 非空 | 审计时间戳 |

`cms_publication_attempts_active_draft` 是 `draft_id` 上的部分唯一索引，限制同一草稿同时只有一个 `prepared` / `in_flight` / `unknown` 操作。`cms_publication_attempts_draft_history(draft_id, created_at)` 保存操作历史，`cms_publication_attempts_reconcile(status, updated_at)` 支持待对账查询。CHECK 约束保证状态取值、快照在未完成状态非空，以及 `committed` 必须同时写入结果 blob/commit SHA。`deployment_status` 允许 `unverified`、`pending`、`running`、`verified`、`failed`、`cancelled`；只有管理员显式核验固定 Deploy 工作流、提交祖先关系及文件 blob 后才更新，证据不足保持 `unverified`。

状态路径是 `prepared → in_flight → committed | conflict | failed | unknown`；`unknown` 只查询同一操作的 Git 结果，不新建操作或盲目重试写入。提交确认后，只有草稿修订号仍等于 `draft_revision` 才关闭草稿为 `published`；若其间有新修订，草稿保持 `active`。Git 提交成功与公开 URL 已部署是两件事。

### `cms_deletion_attempts`：固定的仓库删除意图

此表只记录已发布 Git 文件的删除，不删除图片、其他文章引用或历史草稿。废弃未发布草稿使用 `cms_drafts.status='discarded'`，不创建仓库删除操作。

| 字段 | 类型 / 默认值 | 含义 |
| --- | --- | --- |
| `operation_id` | `TEXT` 主键 | 幂等操作 ID；服务层要求 UUID |
| `target_path` / `public_path` | `TEXT` 非空 | 待删除文件及对应站点路径 |
| `expected_blob_sha` | `TEXT` 非空 | 打开时的 Git blob SHA，用于版本条件删除 |
| `status` | `TEXT` 非空，默认 `prepared` | `prepared`、`in_flight`、`unknown`、`committed`、`conflict`、`failed` |
| `result_commit_sha` | `TEXT` 可空 | 仅 `committed` 状态非空 |
| `deployment_status` | `TEXT` 非空，默认 `unverified` | 当前不自动确认线上 URL 已消失 |
| `created_by` | `TEXT` 非空 | 发起人标识 |
| `completed_at` | `INTEGER` 可空 | 得到确定结果时的毫秒时间戳 |
| `created_at` / `updated_at` | `INTEGER` 非空 | 审计时间戳 |

`cms_deletion_attempts_active_path` 是 `target_path` 上的部分唯一索引，限制同一路径同时只有一个 `prepared` / `in_flight` / `unknown` 删除操作；`cms_deletion_attempts_reconcile(status, updated_at)` 支持待对账查询。CHECK 保证状态取值及 `committed` 必有结果 commit SHA。删除前服务层检查目标路径、Git blob SHA 和同路径活动草稿；`prepared` 被条件认领后才执行 Git 删除。结果未知时按原 `operation_id` 对账，不对可能已更新的文件再次删除。

### 迁移与运行边界

- `0000_friend_links.sql` 创建友链表；`0001_marvelous_ares.sql` 创建草稿和发布操作表；`0002_modern_dragon_man.sql` 创建删除操作表；`0003_yielding_sasquatch.sql` 创建草稿图片元数据表。Schema、SQL、迁移快照及 `_journal.json` 应一起提交。
- 本地开发 D1 已应用上述 CMS 迁移。远端是否已应用必须在部署前单独核验；未迁移时 CMS 草稿、发布和删除接口会因缺表失败。
- 本地 snapshot 内容源可用于只读和草稿验证，当前没有受验证的本地 Git 写入/删除适配器。远端发布或删除还依赖服务端固定的 GitHub 仓库、分支和凭证配置。
- D1 原子性只覆盖数据库自身；Git 写入成功但响应丢失时，操作记录可能暂留 `in_flight` / `unknown`，需按同一操作 ID 对账。`deployment_status='unverified'` 不表示公开站点已经更新。

## 默认值与更新语义

`createdAt` / `updatedAt` 的 `$defaultFn` 在 Drizzle 插入时执行；`updatedAt` 的 `$onUpdateFn` 在 Drizzle 更新且未显式设置该值时执行。

这些是 **ORM 运行时行为**，不会生成 SQL DEFAULT 或数据库触发器。原生 SQL、`executeD1Batch`、外部脚本必须显式提供 ID/审计字段；更新时也要设置 `updated_at`。历史行新增 NOT NULL 列需要 SQL 默认值或分阶段回填，不能依赖 `$defaultFn` 修复旧数据。

软删除列只是存储标记，不会自动过滤记录。每个业务 Repository 必须明确是否排除已删除行，并设计软删除与唯一约束如何共存。

## 查询与一致性

- 按真实 WHERE / JOIN / ORDER BY 设计索引，以 EXPLAIN QUERY PLAN 和代表性数据验证。
- 唯一约束、外键和 CHECK 应承担关键数据不变量，不能仅在应用层先查再写。
- 计数采用 SQL 原子增量；避免先 SELECT、再在 JavaScript 中加一后 UPDATE。
- 多语句写入用 Drizzle `db.batch` 或 `executeD1Batch`；D1 batch 失败会整批回滚。
- UPDATE 影响零行本身不一定是错误；涉及扣减、条件更新等业务时必须检查结果并设计不变量，不能误以为 batch 自动验证业务成功。
- 单个事务中后续语句不能等待前面 SQL 的返回值后再动态构造。跨请求流程需单独设计幂等键、状态机和补偿。
- 限制列表大小，使用稳定排序和必要索引，不建立当前无消费者的万能 Repository 实现。
- KV 仅缓存可接受短期陈旧的数据，不能承担原子计数或强一致幂等控制。

## 迁移路径

`drizzle.config.ts`：schema 入口为 `src/server/db/schema/index.ts`，输出 `drizzle/migrations`。Wrangler 的 migrations_dir 指向同一路径。

```bash
pnpm db:generate        # 根据 schema 与历史快照生成 SQL
pnpm db:check           # 检查迁移元数据一致性
pnpm db:migrate:local   # 在本地 D1 应用实际迁移
pnpm check:server
pnpm test:server
```

提交时包括 schema、SQL、快照和 journal。禁止生产控制台手工执行未经版本控制的 DDL。发布前在测试数据上验证迁移及新旧代码兼容性；破坏性变更先扩展、回填、切换读写，最后收缩。

`pnpm db:migrate:remote` 会修改 wrangler.toml 指定的远程数据库，属于发布操作。发布前确认备份/恢复方案与目标环境；代码回滚不会自动回滚 schema，也不能依赖反向 DDL 恢复已删除数据。

## 绑定与验证范围

D1 和 KV 的部署 binding 位于 `wrangler.toml`，实际资源名称和运维元数据保存在本地 `.env`，不写入公开文档。本地仿真不会因为配置生产 binding 而自动访问远程资源。

`pnpm test:server` 用临时本地 D1/KV 验证审计字段、批处理回滚、缓存流程，以及 CMS 草稿修订、发布幂等对账和删除状态转换。运行时测试另建的临时表不属于业务 schema，也不生成正式迁移；CMS 草稿、发布、删除和图片元数据四张表属于正式 schema 和迁移。线上权限、资源存在性和远程迁移需在发布环境另行验证。

### `cms_draft_assets`：草稿图片元数据

`0003` 新增图片元数据表。`id` 使用 `cma_` 前缀；`draft_id` 外键指向草稿，`object_key` 是站点图片桶内的对象存储位置，`content_hash` 是 SHA-256，`mime`、`bytes` 描述经过图片字节校验的文件，`public_path` 保存固定 URL 对应的 `public/images/blog/<id>.<ext>` 逻辑路径。`status=staged` 时本站 Worker 仅允许后台预览；文章发布确认后，引用该图片的记录转为 `committed`，Worker 才通过 `/images/blog/<id>.<ext>` 匿名提供图片。这里的 `committed` 表示公开服务开放，**不表示图片字节已提交 Git**。`created_by`、`created_at`、`updated_at` 记录审计信息。对象 key 和公开路径分别唯一，`(draft_id, status)` 支持按草稿列举。图片字节使用现有 S3 兼容适配器，复用 `SUPABASE_STORAGE_BUCKET` 公开桶，不进入 D1。不再要求独立草稿桶；`staged`/`committed` 只控制本站 Worker 路由，公开桶直链可能在发布前访问到图片，不能用于私密素材。

上传接口先写对象，再写 D1；D1 写入失败会尝试清理对象。极端中断仍可能留下无元数据的对象，后续清理任务应按前缀与 D1 记录核对。图片和文章跨 S3、D1、GitHub 没有原子事务；发布确认后开放图片可重试对账，生产须保留对象及 D1 记录，不得因文章删除而立即清除共用图片。`staged` 返回的本站公开路径尚不可访问（不代表桶直链也不可访问）；`committed` 后通过公开 Worker 路由读取，站点页面仍需等部署完成才会引用新图片。

完整 HTTP、缓存和服务分层约定见 [服务端 README](../src/server/README.md)。

### `cms_document_revisions`：不可变保存快照（0005）

状态侧栏的修改历史从此表读取，不再将 `cms_drafts.revision` 递增误认为旧正文已经保留。每次成功创建/保存草稿，以同一原子批处理追加一条 `cmr_` 快照；`draft_id + revision` 唯一，`target_path + created_at + id` 支持历史查询。只追加，不提供更新/恢复接口；迁移前已覆盖的版本不追补。

快照包含源文、内容哈希、字节数、标题摘要、草稿修订与创建者/毫秒时间。摘要接口不返回正文或创建者；单个快照要求管理员权限并校验路径归属。发布尝试另增可空 `backend` 及路径历史索引，旧数据保留未知通道。详细接口与交互约定见 [CMS 规范](./specs/pageel-cms-spec.md#文稿状态与历史2026-10-25)。
