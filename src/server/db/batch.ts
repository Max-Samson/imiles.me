import type { D1Database, D1PreparedStatement, D1Result } from '@cloudflare/workers-types';
import { InternalServerError } from '../errors';

/**
 * 执行 Cloudflare D1 原生原子批处理（Batch Execution）
 *
 * 【前端视角通俗解释】：
 * 在传统后端里，若要同时执行 3 步数据库写操作（例如扣减积分、生成订单、记录日志），会开启“数据库事务”（Transaction）。
 * 但在边缘计算中，Worker 与 D1 之间是通过网络通信的。如果像传统后端那样一次次 await 往返，网络延迟会成倍叠加。
 * Cloudflare D1 原生提供了 `batch()` 特性：
 * 把你准备好的多条 SQL 语句一次性打包发送给 D1 集群，D1 会在底层自动以【全成功或全回滚】的事务方式执行，
 * 只要其中一条报错，全部自动回滚，而且整个过程只消耗一次网络往返！
 *
 * @param d1 原生 D1 数据库句柄
 * @param statements 待执行的 D1PreparedStatement 数组
 * @returns 每条 SQL 执行结果组成的数组
 * @throws InternalServerError 批处理失败时抛出异常并附带报错信息
 */
export async function executeD1Batch<T = unknown>(
  d1: D1Database,
  statements: D1PreparedStatement[],
): Promise<D1Result<T>[]> {
  if (statements.length === 0) {
    return [];
  }

  try {
    const results = await d1.batch<T>(statements);
    return results;
  } catch (error) {
    console.error('[Cloudflare D1 批处理执行失败]:', error);
    throw new InternalServerError(
      `D1 批处理执行失败: ${error instanceof Error ? error.message : '未知错误'}`,
      { statementCount: statements.length },
    );
  }
}
