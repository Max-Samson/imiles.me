import { integer, text } from 'drizzle-orm/sqlite-core';

/**
 * 生成带业务语义前缀的分布式唯一短 ID
 *
 * 【前端视角通俗解释】：
 * 在前端开发中，我们常用类似 `key={item.id}` 标识列表项。
 * 传统自增数字 ID（1, 2, 3...）容易被爬虫猜测并遍历全站数据。
 * 我们使用 16 位的十六进制随机字符串，并加上前缀（如 `art_xxx`、`react_xxx`），
 * 这样看日志或接口返回时一眼就能知道这是哪张表的数据。
 *
 * @param prefix 业务前缀（例如 "art" 代表文章、"view" 代表浏览、"react" 代表点赞）
 */
export function generateEntityId(prefix = 'ent'): string {
  const randomPart = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  return `${prefix}_${randomPart}`;
}

/**
 * 构造标准的主键 ID 列定义
 *
 * 【前端使用方式】：
 * 在定义表时直接展开：
 * ```ts
 * export const myTable = sqliteTable('my_table', {
 *   id: primaryKeyColumn('art'),
 *   ...
 * });
 * ```
 */
export function primaryKeyColumn(prefix = 'id') {
  return text('id')
    .primaryKey()
    .$defaultFn(() => generateEntityId(prefix));
}

/**
 * 构造通用审计时间戳列（创建时间 + 最近更新时间）
 *
 * 【前端视角通俗解释】：
 * 类似于一个通用的字段模板。每个表都需要记录什么时候创建、什么时候修改。
 * 使用函数每次返回全新的字段实例，避免不同表之间复用同一个字段引用发生冲突。
 */
export function auditTimestamps() {
  return {
    /** 首次创建记录的毫秒时间戳（自动填充当前 Date.now()） */
    createdAt: integer('created_at')
      .notNull()
      .$defaultFn(() => Date.now()),
    /** 最近一次更新的毫秒时间戳 */
    updatedAt: integer('updated_at')
      .notNull()
      .$defaultFn(() => Date.now()),
  };
}

/**
 * 构造支持软删除（回收站机制）的时间戳列
 *
 * 【前端视角通俗解释】：
 * 当用户在后台点击“删除文章/留言”时，很多时候我们不希望真正从硬盘彻底抹掉（防止误删），
 * 而是把 `deletedAt` 设置为当前时间戳。
 * 查询有效数据时只要判断 `WHERE deleted_at IS NULL` 即可。
 */
export function softDeleteTimestamp() {
  return {
    /** 软删除标记时间戳，为 null 时代表记录有效正常显示，有值代表已移入回收站 */
    deletedAt: integer('deleted_at'),
  };
}
