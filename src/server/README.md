# 服务端基础能力与开发约定

服务端运行在 Astro 5 + Cloudflare Workers，当前包含通用 HTTP 基础设施、D1/KV/S3 访问、Cloudflare Access 管理鉴权，以及友链申请和审核模块。代码按业务模块组织；共享目录只保留已有多个调用方或具有独立安全边界的能力。

## 当前结构

```text
src/pages/api/v1/health.ts  存活探针
src/server/
  admin/session/           后台会话接口
  db/                      请求级 Drizzle 客户端、批处理和表结构
  errors/                  领域异常与 HTTP 错误出口
  friend-links/            友链 Route、Service、Repository、上传与保护逻辑
  kv/                      有限 TTL、数据解码与 Cache-Aside
  media/                   通用图片验证和完整性读取
  rest/                    路由封装、参数解析、请求体、CORS 与 HTTP 缓存
  security/access/         Access JWT 验证、Actor 映射与能力授权
  security/origin.ts       写请求同源校验
  storage/                 对象存储接口与 S3 实现
  types/                   响应、分页、查询契约与 ETag 格式化
src/shared/admin/          服务端与后台 UI 共用的会话契约和能力常量
src/worker-configuration.d.ts  从 Wrangler 配置生成的绑定类型
```

`drizzle/migrations/` 保存已生成的 SQL 和 Drizzle 元数据。迁移文件必须与 `src/server/db/schema/` 的表结构同步。

## 分层边界

业务链路为 `API Route → Service → Repository → D1`，Service 可协调 KV。

- Route 负责 Request/Response、Zod 入参校验和 HTTP 缓存。
- Service 接收业务 DTO 与显式依赖，不接收 Astro APIContext 或 Cloudflare 环境绑定。
- Repository 封装 SQL，接收中性的查询类型或业务专属 DTO。不要把用户传入的字段字符串直接拼接为 SQL。
- 数据库、KV 来自当前请求；不要在模块顶层保存用户状态或创建绑定客户端。
- Route 通过模块内工厂完成请求级依赖装配，不直接调用 Repository。
- 正确性关键写入必须 await 完成后才能返回成功。后台任务只用于允许失败的辅助工作。

## 管理身份与权限

`security/access/` 负责验证 Cloudflare Access JWT，并映射为稳定的用户或服务 Actor。身份验证成功后仍需按 Route 检查 `admin:read`、`admin:write` 或 `admin:maintenance`。

- 用户必须同时通过 Access Policy 和 `ADMIN_EMAILS` 精确白名单，当前拥有三项管理能力。
- Service Token 的 Client ID 必须在 `ADMIN_SERVICE_TOKEN_IDS` 中，并通过 `ADMIN_SERVICE_TOKEN_CAPABILITIES` 显式授权；缺少能力配置时默认拒绝。
- `ADMIN_SERVICE_TOKEN_CAPABILITIES` 是 JSON 对象，例如 `{"review-tool.access":["admin:read","admin:write"]}`。未知 Client ID、未知能力或无效 JSON 都按服务端配置错误处理。
- 浏览器写请求必须通过同源校验；无 `Origin` 的机器请求只允许已验证并获授权的 Service Token。
- 模块级只缓存 Remote JWK Set 的公开证书解析器，不缓存 JWT、Actor 或请求数据。

## 统一路由入口

使用 `defineRestRoute` 并导出 Astro `ALL`，自动处理 405/Allow、OPTIONS、HEAD、异常脱敏、X-Request-Id、nosniff 与默认 no-store。默认不开启跨域访问；有跨域需求时显式指定 CORS。

```ts
import { z } from 'astro/zod';
import { defineRestRoute, readJsonBody } from '@/server/rest';
import { jsonSuccess } from '@/server/types';

export const prerender = false;
const input = z.object({ text: z.string().trim().min(1).max(200) }).strict();

// 示例：验证并回显输入；实际业务改为调用相应 Service。
export const ALL = defineRestRoute({
  POST: async (ctx, route) => {
    const data = await readJsonBody(route.request, input);
    return jsonSuccess(data, undefined, { requestId: ctx.requestId });
  },
});
```

- JSON 请求默认最多 64 KiB，按实际流字节数校验；不信任 Content-Length。
- 非 JSON 返回 415，超限返回 413，无效 JSON/参数返回 400。
- `parseInput(schema, route.params)` 可校验路径参数；业务规则继续在 Service 校验。
- 201 使用 `jsonCreated(data, location)`；204 使用 `jsonNoContent()`。
- `handleApiError` 对所有 5xx 始终脱敏，不依赖 NODE_ENV。内部异常写服务端日志；客户端通过响应头及错误 meta 的 requestId 关联。
- RequestId 优先使用 Cloudflare Ray ID，否则生成 UUID，不直接采信客户端 X-Request-Id。
- `GET /api/v1/health` 仅表示进程能响应；不访问 D1/KV，也不代表依赖服务已就绪。

## 参数与分页

`parseRestQuery(route.url, options)` 支持 page/pageSize（limit 为 pageSize 别名）、sort、q、fields 和过滤字段。默认每页 20，最大 100，最大 offset 为 100000，可按业务调小或调整。

```ts
const query = parseRestQuery(route.url, {
  allowedSortFields: ['createdAt', 'title'],
  defaultSort: [{ field: 'createdAt', direction: 'desc' }],
  allowedFilterFields: ['status'],
  allowedFields: ['id', 'title'],
});
```

- 默认只允许 createdAt 排序；过滤和投影字段默认拒绝。
- 非正整数、偏移溢出、重复参数、未知字段、无效排序方向返回 400。
- pageSize 超过上限会收敛到上限；参数格式错误不会被悄悄修正。
- cursor/offset 目前明确拒绝。需要游标分页时为业务单独设计契约与稳定排序，不混用两套分页语义。
- Repository 把已校验字段映射到固定 Drizzle columns，过滤值继续参数化绑定。此解析器不能代替授权检查。

## CORS 与 HTTP 缓存

```ts
export const ALL = defineRestRoute({ GET: handler }, {
  cors: { origin: ['https://imiles.me'], credentials: true },
});
```

- 携带凭据必须显式白名单，不能使用省略来源或 `*`；opaque `null` 来源不开放。
- 预检检查请求方法和请求头；普通响应与错误响应均设置正确的 CORS/Vary。
- CORS 不是身份鉴权，也不能替代 Cookie 写接口的 CSRF 防护。
- 默认 no-store。只有公开、与用户身份无关的 GET/HEAD 数据才显式使用 `withCache`；`sMaxAge` 要求 `public: true`。
- `withCache` 只构造 HTTP 标头，不会自动写入 Workers Cache API，也不保证 Worker 生成的 JSON 被 CDN 缓存。
- `checkEtagMatch` 支持强/弱 ETag 和列表；命中后调用 `jsonNotModified`，同时保留与 200 响应一致的 Cache-Control/Vary。
- 若 JSON 包含每次变化的 meta.timestamp，按业务版本生成的 ETag 应使用弱标签，例如 `W/"article-v2"`，不能声称字节完全相同。

## KV 缓存

```ts
const value = await getOrLoadCache(kv, cacheKey('stats', slug), loadFromDatabase, {
  parse: statsSchema.parse,
  ttlSeconds: 300,
});
```

- 默认 TTL 300 秒；正整数小于 60 时提升到 60，零/负数/非整数直接报配置错误。
- key 为 `imiles:cache:<module>:<encoded-id>`；不要将原始 IP、凭据放入 key。
- `safeCacheGet` 默认返回 unknown；传入 schema.parse 才获得经过运行时校验的类型。
- 缓存缺失、读取失败或旧格式校验失败会回源；权威数据源失败继续抛出，不伪装为成功。
- `safeCacheSet/Delete` 对 KV 网络失败返回 false；配置和序列化错误抛出。项目限制缓存 JSON 不超过 1 MiB。
- null 不缓存。写业务数据后主动失效；删除失败要按业务容忍度处理，有限 TTL 只提供最终兜底。
- KV 是最终一致性的缓存，没有原子的 read-modify-write。不能用于严格限流、准确计数、幂等锁或需要立即撤销的鉴权状态。准确计数在 D1 用单条原子 SQL 更新。
- 本地模拟测试不证明跨区域一致性；业务必须允许短期陈旧数据。

## 后台任务与环境

`await ctx.defer(() => cacheWrite())` 在 Worker 中使用绑定的 `runtime.ctx.waitUntil`；无 runtime 的本地上下文会等待任务完成，错误统一记日志。该 API 不是可靠队列，不提供重试和幂等保证。

绑定类型由 `pnpm cf:types` 生成。`CloudflareEnv` 在本地允许缺少 DB/KV，实际使用通过 `requireBinding` 明确失败。Secrets 通过 Cloudflare Secrets 或本地 `.dev.vars` 注入，禁止提交。

当前 wrangler.toml 配置用户指定的 D1/KV 资源；本地命令使用模拟资源。未来增加 staging 必须绑定独立测试资源，不能复用生产 ID。

## 验证与迁移

```bash
pnpm cf:types
pnpm check:server
pnpm test:server
pnpm db:check
pnpm build
```

`test:server` 包含 HTTP 边界测试以及 D1/KV 本地集成测试。集成测试固定 `persist:false` 与 `remoteBindings:false`，不会修改线上资源或已有本地数据库。

业务表变更：修改 schema → 导出 → `pnpm db:generate` → 检查 SQL → `pnpm db:migrate:local` → 测试 → 审查后应用远程迁移。不要把“Drizzle 元数据检查通过”当作 SQL 执行或业务正确性验证。

详见 [数据库约定](../../docs/database-design.md) 与 [架构概览](../../docs/server-database-architecture.md)。

Astro 自身的来源检查可能在路由执行前拒绝跨源表单 POST（403）；不要为统一 JSON 响应而关闭这层保护。路由封装覆盖进入业务处理器后的分支，JSON 客户端应发送正确的 Content-Type。


## 友链与通用图片服务

友链采用单表 `friend_links`，详见 [接口与迁移说明](../../docs/friend-links-design.md)。公开接口固定投影，不返回邮箱或审核元信息。

[通用文件与图片服务](./media/README.md) 独立于友链，支持 S3 兼容存储、静态图片校验与完整性读取；业务模块负责权限和对象生命周期。
