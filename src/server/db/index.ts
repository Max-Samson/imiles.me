import type { D1Database } from '@cloudflare/workers-types';
import { type DrizzleD1Database, drizzle } from 'drizzle-orm/d1';
import type { CloudflareEnv } from '../../env.d';
import { requireBinding } from '../env';
import * as schema from './schema';

/**
 * 数据库客户端配置项
 */
export interface DbClientOptions {
  env: CloudflareEnv;
}

/**
 * 从运行时环境中安全提取 Cloudflare 原生 D1 数据库实例
 *
 * 【前端视角通俗解释】：
 * D1Database 是 Cloudflare 提供的底层原生句柄，类似于原生的 `window.indexedDB` 或 `fetch`。
 * 它只提供了最基础的 SQL 执行能力（如 `db.prepare("SELECT * FROM ...").all()`）。
 * 在绝大多数业务场景下，我们推荐使用下面的 `createDrizzleClient`，拥有完备的 TypeScript 强类型支持。
 *
 * @param env 环境变量聚合对象
 * @returns Cloudflare D1 原生实例
 */
export function getD1Database(env: CloudflareEnv): D1Database {
  return requireBinding(env, 'DB');
}

/**
 * 创建具备强类型提示的 Drizzle ORM 数据库客户端
 *
 * 【前端视角通俗解释】：
 * 类似于在前端创建带有泛型声明的 Axios 或 React Query 实例。
 * 我们把原生 D1 数据库与项目的所有表结构（schema）绑定在一起，生成强类型的 `db` 对象。
 * 之后你在调用 `db.select().from(schema.articleViews)` 时：
 * 1. VS Code 会自动联想 `slug`、`views` 等字段名，杜绝拼写错误。
 * 2. 查询返回的数据类型会自动推导为 `{ id: string; views: number; ... }`，无需手写 `as Type` 强转。
 *
 * @param env 环境变量聚合对象
 * @returns 绑定了全站表结构的强类型 Drizzle D1 数据库实例
 */
export function createDrizzleClient(env: CloudflareEnv): DrizzleD1Database<typeof schema> {
  const d1 = getD1Database(env);
  return drizzle(d1, { schema });
}

/**
 * 数据库通用审计字段类型定义（全站所有业务表统一遵循此规范）
 *
 * 【前端视角通俗解释】：
 * 在数据库开发中，凡是重要的业务数据，都应该记录“什么时候创建的”、“什么时候更新的”。
 * 如果支持“假删除 / 回收站功能”，还会多一个 `deletedAt`（软删除时间戳）。
 */
export interface AuditFields {
  /** 创建时间戳（13 位毫秒 Unix 时间戳，对应 JS 的 Date.now()） */
  createdAt: number;
  /** 最近更新时间戳（13 位毫秒 Unix 时间戳） */
  updatedAt: number;
  /** 软删除时间戳，为 null 时代表记录正常有效，有时间戳代表已移入回收站 */
  deletedAt?: number | null;
}

// 导出完整的表结构定义，供上层 Service / Repository 模块调用
export { schema };
export * from './batch';
