# 服务端与数据库架构概览

运行环境：Astro 5 SSR + Cloudflare Workers。结构化业务数据采用 D1/Drizzle，允许最终一致性的缓存采用 Workers KV。

## 已实现

| 能力 | 入口 |
| --- | --- |
| 请求级环境绑定 | `src/server/env.ts`；Wrangler 生成 `src/worker-configuration.d.ts` |
| D1 客户端与原子批处理 | `src/server/db/` |
| ID、审计、软删除列 | `src/server/db/schema/common.ts` |
| 独立于 HTTP 的查询/仓储契约 | `src/server/types/query.ts`、`src/server/repositories/` |
| 异常脱敏与标准响应 | `src/server/errors/`、`src/server/types/` |
| 路由、CORS、参数、JSON、ETag | `src/server/rest/` |
| 有限 TTL、数据解码、Cache-Aside | `src/server/kv/` |
| 存活探针 | `/api/v1/health`，不代表 D1/KV 就绪 |
| 回归验证 | `pnpm check:server`、`pnpm test:server` |

## 按业务增加

目前没有业务表、正式 SQL 迁移、具体 Repository 或 Service。鉴权、CSRF、严格限流、幂等控制应在相应写接口开放前实现；R2 上传和队列按实际需求增加，不提前创建空抽象。

业务依赖方向为 `API Route → Service → Repository → D1`，Service 协调 KV。HTTP 对象仅在接入层使用，基础设施句柄来自当前请求，无模块级用户状态。

KV 不能充当准确计数器或原子限流器。Workers 实例可能并发复用，不应理解为每个请求都会创建独立的全新 Isolate。设置 Cache-Control 不会自动将 Worker 响应写入边缘缓存。

## 文档职责

- [服务端 README](../src/server/README.md)：当前 API、边界规则与使用示例。
- [数据库设计](./database-design.md)：字段约定、事务边界及迁移流程。
- [服务端审查指南](./claude-code-practices/command/资深Cloudflare与Node服务端架构师代码审查.md)：审查检查项；平台额度、产品限制以当前官方文档为准。

验证命令及本地/远程操作边界均见上述文档。新增资源绑定后重新执行 `pnpm cf:types`，新增业务表后必须生成并实际验证迁移。
