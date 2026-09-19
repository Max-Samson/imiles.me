# Server & Database Architecture Specification
# 服务端与数据库开发规范与架构设计指南

> **适用对象**：AI 编码助手（Agents）、后端/全栈工程师及后续系统维护者。  
> **核心原则**：本目录（`src/server/`）与路由层（`src/pages/api/`）共同构成 `imiles.me` 站点的边缘服务端与数据持久化体系。遵循**分层解耦（Clean Layering）、类型安全（End-to-End Type Safety）、边缘就绪（Edge-Native）与零结构冗余（Zero Confusion）**的工程设计规范。

---

## 目录索引

1. [架构背景与设计哲学](#1-架构背景与设计哲学)
2. [技术栈选型与职责矩阵](#2-技术栈选型与职责矩阵)
3. [功能目录拓扑与单向依赖红线](#3-功能目录拓扑与单向依赖红线)
4. [数据库（Cloudflare D1 + Drizzle ORM）设计规范](#4-数据库cloudflare-d1--drizzle-orm设计规范)
5. [边缘存储（Cloudflare KV & R2）规范](#5-边缘存储cloudflare-kv--r2规范)
6. [RESTful API 资源建模与接口设计规范](#6-restful-api-资源建模与接口设计规范)
7. [统一通信契约与类型系统](#7-统一通信契约与类型系统)
8. [架构红线与 8 大避坑反模式](#8-架构红线与-8-大避坑反模式)
9. [标准生产级代码起手式模板](#9-标准生产级代码起手式模板)
10. [AI Agent 服务端功能研发 5 步标准作业程序 (SOP)](#10-ai-agent-服务端功能研发-5-步标准作业程序-sop)
11. [环境配置与 Wrangler 部署清单](#11-环境配置与-wrangler-部署清单)
12. [代码审查与质量防腐准入指南](#12-代码审查与质量防腐准入指南)
---

## 1. 架构背景与设计哲学

本项目是基于 **Astro 5 (`output: 'server'`) + React 19** 构建的个人站点与技术博客，部署于 **Cloudflare Workers (Edge Runtime)**。

在边缘计算运行时中，没有传统 Node.js 长期驻留的有状态进程，每个请求运行在轻量级 V8 Isolate 中。为避免后续开发中产生“路由直接堆砌 SQL”、“模块顶层误用环境变量”、“数据结构与返回随意”等常见架构泥潭，确立以下四大设计哲学：

1. **边缘原生 (Edge-Native & Stateless)**：
   - 代码完全无状态，充分利用 Cloudflare 遍布全球的边缘节点。
   - 所有外部资源（D1 关系型数据库、KV 缓存、R2 对象存储）均通过请求上下文的 Bindings 动态注入，杜绝模块级全局单例状态泄漏。
2. **职责分层 (Strict Separation of Concerns)**：
   - **路由层（API Route）**：仅负责 HTTP 协议适配、Zod 入参校验与 JSON 序列化。
   - **服务层（Service）**：负责纯业务逻辑、事务编排、权限判定与缓存调度，绝不接触 HTTP `Request`/`Response` 原语。
   - **仓储层（Repository）**：封装 Drizzle ORM 与数据持久化查询，屏蔽数据库底层细节。
3. **强类型契约驱动 (Contract-First & Type-Safe)**：
   - 数据库 Schema、输入校验（Zod DTO）、服务出参到 API 响应，全链路拥有 100% 静态类型推导，严禁使用 `any` 或未经校验的类型断言。
4. **统一防御式响应 (Predictable Errors & Responses)**：
   - 全站所有 API 统一采用 `ApiResponse<T>` 协议封装，错误派生自 `AppError` 层次结构，绝不泄露裸错误堆栈或底层 SQL 错误给终端用户。

---

## 2. 技术栈选型与职责矩阵

| 领域 | 选型技术 | 核心定位与职责 | 为什么选择（选型优势） | 严禁行为 / 替代淘汰项 |
| :--- | :--- | :--- | :--- | :--- |
| **运行时** | **Cloudflare Workers** (`@astrojs/cloudflare`) | 边缘请求处理引擎，支持 Web Standards 与 `nodejs_compat` | 全球低延迟冷启动为零，与 Cloudflare 基础设施无缝绑定 | 严禁引入重度依赖 Node.js C++ 拓展或常驻后台守护进程的库 |
| **关系数据库** | **Cloudflare D1** (Serverless SQLite) | 结构化数据持久化（如浏览计数、点赞互动、评论留言、订阅关系） | 原生嵌入 Cloudflare 网络，支持跨区域自动读副本，支持标准 SQL | 严禁直接连外部未做连接池的传统单机数据库（避免耗尽连接） |
| **ORM 框架** | **Drizzle ORM** (`drizzle-orm` + `drizzle-kit`) | 类型安全的 SQL 查询构建器、Schema 声明与迁移治理 | 零运行时体积开销、原生适配 D1 SQLite、类型推导极快，远优于 Prisma（Prisma 在边缘端二进制引擎太重） | 严禁在代码中到处拼接裸 SQL 字符串；严禁使用 TypeORM/Sequelize |
| **键值缓存** | **Cloudflare Workers KV** | 亚毫秒级高频读取、页面/统计缓存、限流计数、瞬态状态 | 全球高频分布式读取、自带 TTL 过期淘汰、零维护成本 | 严禁将其当作强一致性关系数据库使用；严禁写入单条超过 1MB 的超大对象 |
| **对象存储** | **Cloudflare R2** | 用户生成资产、图片、备份、导出文件持久化 | S3 兼容 API、零出网流量费（Zero Egress Fees） | 严禁将大体积静态二进制资产存入 D1 或 KV 中 |
| **参数校验** | **Zod** | 运行时请求入参（Query, Params, Body）及环境变量防御性校验 | 与 TypeScript 类型天然双向推导，Astro 内置已深度集成 | 严禁跳过校验直接使用 `as Type` 强转原始 `request.json()` |
| **代码规范** | **Biome** | 格式化与静态代码分析 | 毫秒级检测、统一代码风格与 import 排序 | 严禁跳过 `pnpm exec biome check` 提交代码 |

---

## 3. 功能目录拓扑与单向依赖红线

所有服务端核心逻辑与数据库交互代码统一收敛至 `src/server/`，HTTP 端点收敛至 `src/pages/api/`：

```
src/
├── server/                          # 🌟 服务端核心领域层（与 HTTP 完全解耦）
│   ├── README.md                    # 本规范文档
│   ├── index.ts                     # 服务端统一公开导出门面
│   ├── env.ts                       # Cloudflare Runtime Bindings 强类型校验与获取
│   ├── types/                       # 统一通信协议（ApiResponse、分页结构等）
│   │   └── index.ts
│   ├── errors/                      # 领域错误层次体系与全局错误转换
│   │   └── index.ts
│   ├── db/                          # 数据库基础设施层
│   │   ├── index.ts                 # Drizzle 实例创建工厂与公共接口
│   │   ├── client.ts                # D1 客户端获取与 Drizzle 实例管理
│   │   └── schema/                  # 数据表定义（按业务领域垂直分片）
│   │       ├── index.ts             # Schema 集中导出入口
│   │       ├── analytics.ts         # 统计/埋点表定义
│   │       └── ...
│   ├── repositories/                # 数据仓储层（DAO，仅负责与 DB/ORM 交互）
│   │   ├── index.ts
│   │   ├── analytics.repository.ts
│   │   └── ...
│   ├── services/                    # 业务用例层（纯业务逻辑、事务调度、缓存策略）
│   │   ├── index.ts
│   │   ├── analytics.service.ts
│   │   └── ...
│   ├── kv/                          # KV 缓存抽象与 Key 命名空间管理
│   │   ├── index.ts
│   │   └── cache.ts                 # Cache-Aside 通用获取与失效封装
│   ├── storage/                     # R2 对象存储抽象（预签名、直传等）
│   │   └── index.ts
│   └── middleware/                  # 鉴权、限流、安全切面
│       ├── rate-limit.ts
│       └── auth.ts
│
└── pages/
    └── api/                         # 🌐 HTTP 接入层（Astro 端点，轻量路由适配器）
        └── [module]/
            └── [action].ts          # 单一职责接口：解析入参 -> 调 Service -> 输出响应
```

### 3.1 架构单向依赖红线 (The Golden Dependency Rule)

各层级之间必须严格遵守单向调用链，**严禁逆向引用，严禁越级穿透**：

```
[客户端请求 (Client HTTP)]
         │
         ▼
[API Route (src/pages/api/*)]           # 仅适配 HTTP、Zod 入参校验
         │
         ▼
[Service 层 (src/server/services/*)]    # 业务逻辑编排、权限判定、调度缓存
         │
         ▼
[Repository 层 (src/server/repositories/*)]  # 纯粹数据持久化、封装 Drizzle 查询
         │
         ▼
[Database / KV / R2 (src/server/db/*, kv/*)] # 基础设施驱动层
```

#### 依赖权限矩阵

| 目录层级 | 可以引入（依赖）的模块 | 绝对禁止引入的模块 |
| :--- | :--- | :--- |
| **`src/pages/api/`** | `src/server/services/`, `src/server/types/`, `src/server/errors/`, `src/server/env.ts`, Zod | ❌ `src/server/repositories/`（禁止跳过 Service 直连持久层）<br/>❌ `src/server/db/schema/` 中的底层 ORM 查询 |
| **`src/server/services/`** | `src/server/repositories/`, `src/server/kv/`, `src/server/storage/`, `src/server/types/`, `src/server/errors/` | ❌ `astro` HTTP 上下文 (`APIContext`, `Request`, `Response`)<br/>❌ `src/pages/api/` 中的任何代码 |
| **`src/server/repositories/`** | `src/server/db/`, `drizzle-orm`, `src/server/errors/`, `src/server/types/` | ❌ `src/server/services/`<br/>❌ HTTP 相关类型与上层路由 |
| **`src/server/db/`** | `drizzle-orm`, `@cloudflare/workers-types` | ❌ 任何业务 Service 或路由层模块 |

---

## 4. 数据库（Cloudflare D1 + Drizzle ORM）设计规范

### 4.1 表与字段命名规约

1. **表名（Table Names）**：
   - 统一采用**小写蛇形复数**（`snake_case`），例如 `article_views`, `post_reactions`, `guestbook_entries`。
   - 关联表/多对多表采用两个实体蛇形连接，例如 `posts_tags`。
2. **字段名（Column Names）**：
   - 统一采用**小写蛇形**（`snake_case`），例如 `article_slug`, `created_at`, `user_ip_hash`。
   - 关联外键字段以 `_id` 结尾，例如 `post_id`, `user_id`。
3. **主键设计（Primary Key）**：
   - 分布式/业务实体表：使用 `text('id')` 作为主键，默认填充统一的分布式短 ID（推荐 16~21 位的 `nanoid` 或时间单调递增的 `ulid`），防止自增主键被恶意遍历泄露业务体量。
   - 纯明细/不可变只增流日志表（如高频埋点流水）：允许使用 `integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true })`。
4. **核心审计字段红线（Audit Fields）**：
   - 凡持久化业务表，**必须**具备 `created_at` 字段（存储毫秒级 Unix 时间戳，推荐 `integer('created_at', { mode: 'timestamp_ms' })`）。
   - 允许更新的表，**必须**具备 `updated_at` 字段。
   - 支持逻辑归档/撤回的表，使用 `deleted_at` 字段进行软删除标记（为 `null` 时代表有效记录）。
5. **用户隐私合规红线**：
   - 严禁明文存储用户的原始 IP 地址。收集访问计数或防刷统计时，必须存储带盐哈希：`sha256(ip + SALT)`。

### 4.2 Drizzle ORM 编码规范

1. **Schema 模块化隔离**：
   - 每个独立领域的表定义放在 `src/server/db/schema/<domain>.ts` 中。
   - 统一在 `src/server/db/schema/index.ts` 中完成 barrel re-export，供 Drizzle 客户端及外部消费。
2. **类型自动导出**：
   - 每一个定义表结构的文件，必须导出该表的 `SelectModel` 和 `InsertModel` 类型，方便在 Repository 与 Service 中使用：
   ```ts
   import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
   import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

   export const articleViews = sqliteTable('article_views', {
     id: text('id').primaryKey(),
     slug: text('slug').notNull(),
     views: integer('views').notNull().default(0),
     createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
     updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
   });

   export type ArticleView = InferSelectModel<typeof articleViews>;
   export type NewArticleView = InferInsertModel<typeof articleViews>;
   ```

### 4.3 数据库迁移版本控制工作流 (Migration Workflow)

禁止在 Cloudflare 生产控制台手动执行未受代码版本控制的 SQL！所有 DDL 变更一律走 Drizzle Kit 迁移流水线：

```
[1. 修改或新增 Schema]
         │
         ▼
[2. 本地生成迁移 SQL 文件] ──> pnpm drizzle-kit generate
         │
         ▼
[3. 本地 Miniflare 运行测试] ──> pnpm wrangler d1 migrations apply imiles-db --local
         │
         ▼
[4. 提交 Git 并经审查合并] ──> 纳入版本控制 (drizzle/ 或 migrations/)
         │
         ▼
[5. 生产环境正式应用迁移] ──> pnpm wrangler d1 migrations apply imiles-db --remote
```

---

## 5. 边缘存储（Cloudflare KV & R2）规范

### 5.1 Cloudflare KV 使用准则

Cloudflare KV 基于最终一致性（Eventual Consistency）模型设计，全球写入同步约需 10~60 秒，读取亚毫秒级。

1. **Key 命名规范**：
   - 统一采用冒号分段格式：`{app}:{module}:{entity}:{identifier}`
   - 示例：
     - 文章浏览计数缓存：`imiles:cache:views:my-first-post`
     - 接口限流计数器：`imiles:ratelimit:ip_abc123:minute`
2. **强制 TTL 过期设置**：
   - 写入 KV 时**必须**显式指定 `expirationTtl`（以秒为单位），严禁写入永久无期限的脏数据，防止存储体积无界膨胀：
   ```ts
   // ✅ 正确：显式设置 1 小时过期
   await env.KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 3600 });
   ```
3. **读取模式：Cache-Aside 统一模式**：
   - 读取时优先检查 KV；未命中则查 D1 数据库，并写回 KV 缓存；数据库写操作时联动失效（Delete/Invalidate）缓存。

### 5.2 Cloudflare R2 对象存储使用准则

1. **对象路径命名规约**：
   - 格式：`{module}/{yyyy}/{mm}/{hash(16)}-{safe-filename}`
   - 示例：`uploads/2026/09/a1b2c3d4e5f67890-cover.webp`
2. **大文件传输规范**：
   - 小于 5MB 的文件允许由 Worker 代理中转。
   - 大于 5MB 的附件或媒体上传，必须通过 Worker 生成 **Presigned Upload URL (预签名上传链接)**，由客户端直接 PUT 上传至 R2，避免消耗 Worker CPU 时间与内存配额。
3. **公开访问与 CDN 缓存**：
   - 公开资源通过自定义域名绑定（例如 `assets.imiles.me`），并在响应头中配置合适的 `Cache-Control`（如 `public, max-age=31536000, immutable`），避免重复触发 R2 的 Class B 读计费。

---

## 6. RESTful API 资源建模与接口设计规范

本项目全面拥抱现代标准 RESTful 架构风格。所有暴露给前端或外部消费的 API 端点必须严格遵守以下六大维度规范：

### 6.1 资源建模与 URI 命名规约

1. **名词复数导向，严禁在 URI 中出现动词**：
   - URI 仅代表服务器端的数据资源。动作由 HTTP Method 表达，绝不能在路径中拼接动作词。
   - ❌ **反模式（禁止）**：
     - `/api/get-articles` (动词 get)
     - `/api/article/create` (动词 create)
     - `/api/delete-guestbook-by-id?id=1` (动词 delete)
     - `/api/update-view-count` (动词 update)
   - ✅ **标准 RESTful（推荐）**：
     - `GET /api/v1/articles`（获取文章集合）
     - `POST /api/v1/articles`（新增文章）
     - `GET /api/v1/articles/:slug/views`（获取某文章的阅读统计子资源）
     - `POST /api/v1/articles/:slug/views`（记录一次阅读打点）
     - `GET /api/v1/guestbook`（获取留言列表）
     - `POST /api/v1/guestbook`（提交新留言）
     - `PATCH /api/v1/guestbook/:id`（更新特定留言内容或状态）
     - `DELETE /api/v1/guestbook/:id`（删除特定留言）
2. **小写与中划线命名（kebab-case）**：
   - 路径统一使用全小写字符，多词资源使用中划线连接，例如 `/api/v1/guestbook-entries`。
3. **版本化控制（API Versioning）**：
   - 所有对外业务端点统一收敛在 `/api/v1/` 命名空间下，为后续非破坏性平滑升级预留契约空间。
4. **资源层级嵌套上限（Max 2-Level Nesting）**：
   - 嵌套层级最多允许 2 层：`/{parent-resource}/:parentId/{child-resource}/:childId`
   - 示例：`GET /api/v1/articles/:slug/comments/:commentId`
   - 若实体关联更加复杂，应将子资源提升为扁平顶层资源，通过 Query 参数建立关联，例如 `GET /api/v1/comments?articleSlug=intro-to-ai`。

### 6.2 HTTP 动词语义与幂等性保障矩阵

每个 HTTP 动词必须严格符合 RFC 规范的语义约定：

| HTTP 动词 | CRUD 映射 | 语义与行为 | 幂等性 (Idempotent) | 安全性 (Safe) | 成功默认状态码 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`GET`** | Read | 获取目标资源的完整表达或集合，无副作用 | 是 | 是 | `200 OK` / `304 Not Modified` |
| **`POST`** | Create / Action | 创建新从属资源，或执行非幂等业务计算 | 否 | 否 | `201 Created` / `200 OK` |
| **`PUT`** | Replace | 完整替换覆盖目标资源（客户端提供完整实体） | 是 | 否 | `200 OK` |
| **`PATCH`** | Update | 部分更新目标资源的指定字段（增量补丁） | 是 | 否 | `200 OK` |
| **`DELETE`** | Delete | 删除指定的资源记录（物理删除或逻辑标记） | 是 | 否 | `200 OK` / `204 No Content` |
| **`OPTIONS`** | Preflight | 浏览器 CORS 跨域预检与服务端支持方法探测 | 是 | 是 | `204 No Content` |
| **`HEAD`** | Read Meta | 仅获取响应标头（如 Content-Length, ETag），无 Body | 是 | 是 | `200 OK` |

### 6.3 HTTP 状态码精密语义映射表

严禁所有场景一律返回 `200 OK` 并在 JSON 内塞自定义业务码的糟糕做法。必须充分利用标准 HTTP 状态码表达网络层与业务状态：

| 状态码 | 英文短语 | 业务语义与最佳实践 |
| :--- | :--- | :--- |
| **`200 OK`** | Success | 请求执行成功，且响应体中包含业务数据。 |
| **`201 Created`** | Created | 资源创建成功。**必须在响应头附加 `Location: /api/v1/resource/:id`** 标明新资源定位。 |
| **`204 No Content`**| No Content | 请求已成功执行，但响应体故意为空（常用于 DELETE、PUT 或 OPTIONS 预检）。 |
| **`304 Not Modified`**| Not Modified| 条件请求命中（If-None-Match 匹配 ETag），服务端零体积返回，直接复用客户端/边缘缓存。 |
| **`400 Bad Request`**| Bad Request | 入参语法错误、必填项缺失、Zod Schema 校验失败。 |
| **`401 Unauthorized`**| Unauthorized| 未携带有效认证凭据，需引导客户端进行身份验证。 |
| **`403 Forbidden`** | Forbidden | 凭据有效但无权操作该资源（如试图删除他人留言）。 |
| **`404 Not Found`** | Not Found | 目标 URI 路径或指定 ID 的数据库记录不存在。 |
| **`405 Method Not Allowed`** | Method Not Allowed | 请求方法不受支持。**必须在响应头附加 `Allow: GET, POST`** 说明所支持的动作。 |
| **`409 Conflict`** | Conflict | 目标资源状态发生业务冲突（如重复点赞、唯一 slug 重复）。 |
| **`412 Precondition Failed`** | Precondition Failed | 条件请求未满足（如 If-Match 版本号不匹配）。 |
| **`422 Unprocessable Entity`** | Unprocessable Entity | 参数语法格式正确，但业务逻辑校验不通过。 |
| **`429 Too Many Requests`** | Rate Limited | 客户端调用频率超过阈值，返回限流通知。 |
| **`500 Internal Server Error`** | Server Error | 服务端非预期代码异常，脱敏后输出通用报错信息。 |

### 6.4 标准 Query 参数语法体系

集合查询必须使用统一的 Query 参数结构，由 `@/server/rest` 的 `parseRestQuery()` 统一解析：

1. **分页 (Pagination)**：
   - 偏移量分页：`?page=1&pageSize=20`（默认上限 100 条，防止单次打爆内存）。
   - 游标分页（大数据流）：`?cursor=rec_123456&limit=20`。
2. **多字段排序 (Sorting)**：
   - 语法：`?sort=-created_at,views` 或 `?sort=views:desc`。
   - 前缀 `-` 表示降序（`desc`），未加或前缀 `+` 表示升序（`asc`）。
3. **字段投影 (Sparse Fieldsets)**：
   - 语法：`?fields=id,slug,views`，允许前端仅按需请求部分字段，降低边缘传输体积。
4. **过滤筛选 (Filtering)**：
   - 精准匹配：`?status=published&lang=zh`。
   - 命名空间模式：`?filter[category]=tech&filter[featured]=true`。
5. **全文检索 (Search)**：
   - 语法：`?q=typescript`。

### 6.5 HTTP 标头治理与缓存协商

1. **边缘缓存与 Cache-Control 治理**：
   - 针对 GET 只读接口，充分利用 Cloudflare 全球边缘节点的就近缓存能力：
     - 静态/低频变动数据：`Cache-Control: public, max-age=60, s-maxage=3600, stale-while-revalidate=86400`
     - 实时高频互动数据：`Cache-Control: public, max-age=5, s-maxage=10, must-revalidate`
     - 用户私密/认证接口：`Cache-Control: private, no-cache, no-store, must-revalidate`
2. **ETag 条件请求与 304 协商 (Conditional Requests)**：
   - 服务端基于实体更新时间或内容 Hash 计算 `ETag: "hash"` 并下发。
   - 客户端下次请求携带 `If-None-Match: "hash"`；若内容未变动，服务端直接返回 `jsonNotModified(etag)`（HTTP 304，无响应体），节省全球出网带宽。
3. **CORS 跨域与全链路追踪**：
   - 预检请求统一通过 `handleCors(request, options)` 处理。
   - 全链路追踪响应头必须带上 `X-Request-Id: req_xxxx`，便于线上问题精准定位。

---

## 7. 统一通信契约与类型系统

### 7.1 统一 API 响应格式 (`ApiResponse<T>`)

全站所有 API 端点必须输出标准 JSON 格式，统一导入自 `@/server/types`：

```ts
// 成功响应结构 (HTTP 200 / 201)
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta?: {
    timestamp: number;
    requestId?: string;
    [key: string]: unknown;
  };
}

// 失败响应结构 (HTTP 4xx / 5xx)
export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;       // 机器可读大写下划线错误码，例如 'VALIDATION_ERROR'
    message: string;    // 人类可读友好错误信息
    details?: unknown;  // 详细字段校验失败原因或上下文（生产环境屏蔽敏感信息）
  };
  meta?: {
    timestamp: number;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;
```

响应辅助构造函数速查表：
- `jsonSuccess(data, init?, meta?)`：输出标准 200 JSON 成功体。
- `jsonCreated(data, location?, init?, meta?)`：输出 201 Created 并注入 `Location` 头。
- `jsonNoContent(init?)`：输出 204 无响应体。
- `jsonNotModified(etag?, init?)`：输出 304 条件协商未修改响应。
- `jsonMethodNotAllowed(allowedMethods, init?)`：输出 405 并自动注入 `Allow` 头。
- `jsonError(error, status?, init?)`：输出标准错误格式。

### 7.2 领域错误层次体系 (`AppError`)

服务层发生异常时，统一抛出对应的 `AppError` 派生异常，路由层捕获后交由 `handleApiError` 自动转换为规范的 HTTP 状态码与响应体：

| 错误类名 | HTTP 状态码 | 业务错误代码 (code) | 典型触发场景 |
| :--- | :--- | :--- | :--- |
| `ValidationError` | 400 | `VALIDATION_ERROR` | 入参格式错误、字段缺失、超长、Zod 校验失败 |
| `UnauthorizedError` | 401 | `UNAUTHORIZED` | 缺少身份令牌、密钥无效 |
| `ForbiddenError` | 403 | `FORBIDDEN` | 无权限操作该实体 |
| `NotFoundError` | 404 | `NOT_FOUND` | 指定文章、评论或记录不存在 |
| `MethodNotAllowedError` | 405 | `METHOD_NOT_ALLOWED` | 请求方式不支持（自动附带 `Allow` 标头） |
| `ConflictError` | 409 | `CONFLICT` | 重复提交、唯一约束冲突 |
| `PreconditionFailedError` | 412 | `PRECONDITION_FAILED` | ETag 不匹配或前置条件失败 |
| `UnprocessableEntityError` | 422 | `UNPROCESSABLE_ENTITY` | 语义或业务规则校验不通过 |
| `RateLimitError` | 429 | `RATE_LIMITED` | 访问频率超限 |
| `InternalServerError`| 500 | `INTERNAL_SERVER_ERROR` | 数据库宕机、未预期系统异常 |
---

## 8. 架构红线与 8 大避坑反模式
在进行服务端与数据库开发时，必须严格规避以下 8 大陷阱：

### 🚫 反模式 1：API 路由中直接写 SQL 或 ORM 链式查询
- **缺陷**：业务逻辑与 HTTP 控制器死死耦合，单元测试无法进行，多端复用变为不可能。
- **标准解法**：路由只调用 Service 方法；数据查询收敛至 Repository。

### 🚫 反模式 2：模块顶层直接解构或假设全局 `process.env` 存在
- **缺陷**：在 Cloudflare Workers 中，环境变量和 D1/KV/R2 实例挂载在每次请求的 `context.locals.runtime.env` 上。模块顶层读取会导致 `undefined` 或多请求间绑定错乱。
- **标准解法**：统一通过 `getServerEnv(context.locals)` 获取运行时环境，按需传入 Service/Repository 工厂。

### 🚫 反模式 3：数据库实体未经脱敏直接序列化输出
- **缺陷**：直接将包含 `salt`、`user_ip_hash`、内部标记或软删除状态的整行数据 `SELECT *` 返回给前端，导致敏感数据泄露。
- **标准解法**：Service 层必须通过 DTO 映射（Mapper）过滤输出，仅返回前端展示所需的白名单字段。

### 🚫 反模式 4：跳过入参校验，直接使用类型断言 `request.json() as Foo`
- **缺陷**：运行时传入恶意畸形 JSON 导致后台直接奔溃，产生未捕获的 500 报错。
- **标准解法**：所有 Query、Params、Body 必须经过 `zodSchema.safeParse()` 验证后才能消费。

### 🚫 反模式 5：随心所欲拼装格式不一的 JSON
- **缺陷**：有些接口返回 `{ result: [] }`，有些返回 `{ code: 0, msg: '' }`，前端对接困难，无法沉淀通用请求拦截器。
- **标准解法**：统一使用 `jsonSuccess(data)` 与 `handleApiError(error)`。

### 🚫 反模式 6：静默吞噬异常或把 SQL 原始异常暴露给终端用户
- **缺陷**：`catch (e) { return jsonSuccess(null); }` 让错误难以排查；或者直接将 SQLite 报错抛给前端引发安全渗透风险。
- **标准解法**：服务端打印详细 `console.error` 日志，返回给客户端脱敏的统一错误码（如 `INTERNAL_SERVER_ERROR`）。

### 🚫 反模式 7：滥用长事务引发 D1 单写锁并发冲突
- **缺陷**：D1 底层是 SQLite，写操作为排他锁。如果事务内执行耗时的网络 `fetch` 或长循环，会导致其他写并发全量超时挂起（`SQLITE_BUSY`）。
- **标准解法**：写事务必须保持极短、极快，严禁在事务内部调用外部第三方 HTTP API。

### 🚫 反模式 8：在 KV 中存放大体积对象或高频并发覆写单个 Key
- **缺陷**：KV 单个 Value 上限 25MB，超过 1MB 读写性能急剧恶化；且由于最终一致性，高频写入同一 Key 会出现严重的读写覆写覆盖。
- **标准解法**：大于 100KB 的数据或文件一律存入 R2；强一致性计数由 D1 或 Durable Objects 承载。

---

## 9. 标准生产级代码起手式模板

以下是端到端新增一个业务模块的标准代码模板：

### 9.1 步骤 1：定义 Drizzle Schema (`src/server/db/schema/analytics.ts`)

```ts
import type { InferInsertModel, InferSelectModel } from 'drizzle-orm';
import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const articleViews = sqliteTable(
  'article_views',
  {
    id: text('id').primaryKey(),
    slug: text('slug').notNull(),
    views: integer('views').notNull().default(0),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (table) => ({
    slugIndex: uniqueIndex('uniq_article_views_slug').on(table.slug),
  }),
);

export type ArticleViewRecord = InferSelectModel<typeof articleViews>;
export type NewArticleViewRecord = InferInsertModel<typeof articleViews>;
```

### 9.2 步骤 2：编写 Repository 仓储 (`src/server/repositories/analytics.repository.ts`)

```ts
import type { D1Database } from '@cloudflare/workers-types';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import { articleViews, type ArticleViewRecord } from '../db/schema/analytics';

export class AnalyticsRepository {
  private db;

  constructor(d1: D1Database) {
    this.db = drizzle(d1);
  }

  async getViewsBySlug(slug: string): Promise<ArticleViewRecord | null> {
    const records = await this.db
      .select()
      .from(articleViews)
      .where(eq(articleViews.slug, slug))
      .limit(1);

    return records[0] ?? null;
  }

  async incrementViews(slug: string): Promise<number> {
    const now = Date.now();
    const id = `view_${crypto.randomUUID().slice(0, 8)}`;

    const result = await this.db
      .insert(articleViews)
      .values({
        id,
        slug,
        views: 1,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: articleViews.slug,
        set: {
          views: sql`${articleViews.views} + 1`,
          updatedAt: now,
        },
      })
      .returning({ views: articleViews.views });

    return result[0]?.views ?? 1;
  }
}
```

### 9.3 步骤 3：编写 Service 业务用例 (`src/server/services/analytics.service.ts`)

```ts
import type { CloudflareEnv } from '../env';
import { requireBinding } from '../env';
import { AnalyticsRepository } from '../repositories/analytics.repository';
import { ValidationError } from '../errors';

export interface ViewStatsDTO {
  slug: string;
  views: number;
}

export class AnalyticsService {
  private repository: AnalyticsRepository;

  constructor(private env: CloudflareEnv) {
    const d1 = requireBinding(env, 'DB');
    this.repository = new AnalyticsRepository(d1);
  }

  async recordView(slug: string): Promise<ViewStatsDTO> {
    const sanitizedSlug = slug.trim().toLowerCase();
    if (!sanitizedSlug || sanitizedSlug.length > 120) {
      throw new ValidationError('Invalid article slug length');
    }

    const views = await this.repository.incrementViews(sanitizedSlug);
    return {
      slug: sanitizedSlug,
      views,
    };
  }

  async getViewStats(slug: string): Promise<ViewStatsDTO> {
    const sanitizedSlug = slug.trim().toLowerCase();
    const record = await this.repository.getViewsBySlug(sanitizedSlug);

    return {
      slug: sanitizedSlug,
      views: record ? record.views : 0,
    };
  }
}
```

### 9.4 步骤 4：编写 RESTful API 路由适配器 (`src/pages/api/v1/articles/[slug]/views.ts`)

```ts
import type { APIRoute } from 'astro';
import { z } from 'astro/zod';
import { createRestContext, handleCors, withCache } from '@/server/rest';
import { handleApiError } from '@/server/errors';
import { AnalyticsService } from '@/server/services/analytics.service';
import { jsonCreated, jsonMethodNotAllowed, jsonNoContent, jsonSuccess } from '@/server/types';

export const prerender = false; // 声明走 Cloudflare SSR 边缘运行时

const ALLOWED_METHODS = ['GET', 'POST', 'DELETE', 'OPTIONS', 'HEAD'];

const paramsSchema = z.object({
  slug: z.string().min(1).max(120),
});

// OPTIONS: 跨域预检处理
export const OPTIONS: APIRoute = async ({ request }) => {
  const preflight = handleCors(request, { methods: ALLOWED_METHODS });
  return preflight ?? new Response(null, { status: 204 });
};

// GET: 获取文章阅读统计（支持边缘 Cache-Control 缓存）
export const GET: APIRoute = async (context) => {
  try {
    const parsedParams = paramsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return handleApiError(parsedParams.error);
    }

    const ctx = createRestContext(context);
    const service = new AnalyticsService(ctx.env);
    const stats = await service.getViewStats(parsedParams.data.slug);

    const response = jsonSuccess(stats);
    // 注入边缘缓存策略：边缘节点缓存 60s，后台重新校验 86400s
    return withCache(response, {
      public: true,
      maxAge: 10,
      sMaxAge: 60,
      staleWhileRevalidate: 86400,
    });
  } catch (error) {
    return handleApiError(error);
  }
};

// POST: 创建/记录一次阅读量（201 Created）
export const POST: APIRoute = async (context) => {
  try {
    const parsedParams = paramsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return handleApiError(parsedParams.error);
    }

    const ctx = createRestContext(context);
    const service = new AnalyticsService(ctx.env);
    const stats = await service.recordView(parsedParams.data.slug);

    return jsonCreated(stats, `/api/v1/articles/${stats.slug}/views`);
  } catch (error) {
    return handleApiError(error);
  }
};

// DELETE: 重置或清理阅读统计（204 No Content）
export const DELETE: APIRoute = async (context) => {
  try {
    const parsedParams = paramsSchema.safeParse(context.params);
    if (!parsedParams.success) {
      return handleApiError(parsedParams.error);
    }

    // 执行业务重置...
    return jsonNoContent();
  } catch (error) {
    return handleApiError(error);
  }
};

// ALL: 兜底处理未支持的 HTTP 请求方法（严格输出 405 Method Not Allowed 并带上 Allow 标头）
export const ALL: APIRoute = async () => {
  return jsonMethodNotAllowed(ALLOWED_METHODS);
};
```
---

## 10. AI Agent 服务端功能研发 5 步标准作业程序 (SOP)

当接到任何服务端新增接口、修改数据模型或集成数据库的需求时，**AI Agent 必须严格遵循以下 5 步 SOP**：

```
[步骤 1] 契约与建模 (Schema & DTO)
         ├─ 文件位置：src/server/db/schema/<domain>.ts
         └─ 规范要求：纯 Drizzle 声明、导出 InferSelectModel 与 InferInsertModel、导出 Zod 校验 Schema

[步骤 2] 数据库迁移 (Migration)
         ├─ 执行命令：pnpm drizzle-kit generate
         └─ 规范要求：检查生成的 SQL 语句无语法问题，本地执行 wrangler d1 迁移确认无误

[步骤 3] 仓储与业务实现 (Repository & Service)
         ├─ 文件位置：src/server/repositories/ 与 src/server/services/
         └─ 规范要求：Repository 仅封装 DB 操作；Service 承载业务逻辑与错误防御；通过 getServerEnv 注入 Bindings

[步骤 4] 路由挂载 (API Route)
         ├─ 文件位置：src/pages/api/<domain>/[action].ts
         └─ 规范要求：设置 export const prerender = false；统一 safeParse 参数；调用 Service；统一使用 jsonSuccess/handleApiError 输出

[步骤 5] 质量验证与生产构建 (Verification)
         ├─ 执行命令：pnpm exec biome check <files>（确保 0 警告 0 错误）
         └─ 执行命令：pnpm build（确保全站 SSR 路由与 Edge 打包无编译故障）
```

---

## 11. 环境配置与 Wrangler 部署清单

在实际配置 Cloudflare Bindings 时，修改项目根目录下的 `wrangler.toml`：

```toml
name = "imiles"
main = "./dist/_worker.js"
compatibility_date = "2026-03-31"
compatibility_flags = ["nodejs_compat"]

[[routes]]
pattern = "imiles.me"
custom_domain = true

[assets]
directory = "./dist"
binding = "ASSETS"

# 1. Cloudflare D1 关系型数据库绑定
[[d1_databases]]
binding = "DB"
database_name = "imiles-prod-db"
database_id = "00000000-0000-0000-0000-000000000000" # 替换为真实 D1 UUID
migrations_dir = "migrations"

# 2. Cloudflare KV 命名空间绑定
[[kv_namespaces]]
binding = "KV"
id = "00000000000000000000000000000000" # 替换为真实 KV Namespace ID

# 3. Cloudflare R2 对象存储桶绑定
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "imiles-media-storage"
```

### 本地调试与部署命令速查

```bash
# 本地开发（启动 Astro 本地服务并自动代理 Cloudflare 平台代理）
pnpm dev

# 本地执行 D1 数据库迁移（基于 Miniflare 本地 SQLite）
pnpm wrangler d1 migrations apply DB --local

# 生产执行 D1 数据库迁移（直接应用至 Cloudflare 全球集群）
pnpm wrangler d1 migrations apply DB --remote

# 运行代码规范校验
pnpm exec biome check src/server src/pages/api

# 生产环境打包验证
pnpm build
```

---

## 12. 代码审查与质量防腐准入指南

为保障服务端与边缘持久化系统的长期稳定性，所有涉及 Cloudflare Workers 部署配置、Drizzle ORM 数据持久化、API 路由与领域服务改动的 Pull Request 或功能交付，必须严格按照项目定制的审查军规执行全流程深度审查：

👉 **核心审查军规文档**：[`docs/claude-code-practices/command/资深Cloudflare与Node服务端架构师代码审查.md`](../../docs/claude-code-practices/command/资深Cloudflare与Node服务端架构师代码审查.md)  
👉 **Claude Code 快捷指令**：`/review-cloudflare-node`（定义于 `.claude/commands/review-cloudflare-node.md`）

### 审查核心 Pipeline 概览
1. **Step 0 机械扫描**：强制 grep 扫描 `process.env` 裸读、`ctx.waitUntil` 遗漏、全局单例状态串态、API 穿透查库、缺少 AbortSignal、危险 `as any` 断言、Node 独占原生模块等 10+ 典型反模式。
2. **Step 1 变更分析**：绘制完整异步调用图至 D1/KV/R2 叶子节点，覆盖全部异常与降级分支，严格验证单向依赖红线。
3. **Step 2 测试执行**：全量执行 `biome check`、`pnpm check`、`pnpm run build`、`drizzle-kit check` 与 Miniflare 本地仿真。
4. **Step 3 深度核查**：深度核对 V8 Isolate 生命周期、D1 原子事务与批处理、KV 最终一致性、内存 Buffer OOM 防范与 CORS 头完整性。
5. **Step 4 全链路与上线发布核验**：对照多入口 × 分支矩阵，执行上线与回滚预案检查。
6. **Step 5 完成度自检**：执行 `grep -c` 命令确认反模式彻底清零后方可给出合并结论。
