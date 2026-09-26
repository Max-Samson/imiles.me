# 数据库设计与迁移约定

当前使用 Cloudflare D1 + Drizzle ORM，数据库工厂与公共列构造器已实现，业务表及正式迁移尚未创建。`drizzle/migrations/meta/_journal.json` 为空是当前状态，不表示数据库结构已经设计完成。

## 命名与公共字段

- 表名使用 snake_case 复数，字段使用 snake_case；TypeScript 属性采用 camelCase。
- 普通索引命名 `idx_<table>_<fields>`，唯一索引命名 `uniq_<table>_<fields>`。
- 业务主键使用 `primaryKeyColumn(prefix)`，格式为业务前缀加完整 UUID（去掉连字符），保留 UUID 随机性。不可用主键难以猜测来替代授权。
- 仅追加日志等业务可按实际访问模式选择整数主键；不要把随机 ID 描述成 D1 避免写锁的机制。
- 时间戳统一使用毫秒数字：`integer` + `Date.now()`。不要与 Drizzle `timestamp_ms` 的 JavaScript Date 模式混用。
- 可修改业务表使用 `auditTimestamps()`；需要撤回/归档时再增加软删除列。

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

`pnpm test:server` 用临时本地 D1/KV 验证审计字段、批处理回滚和缓存流程；测试表不属于业务 schema，也不生成正式迁移。线上权限、资源存在性和远程迁移需在发布环境另行验证。

完整 HTTP、缓存和服务分层约定见 [服务端 README](../src/server/README.md)。
