import type { RestQueryParams } from '../rest/query';
import type { PaginatedResult } from '../types';

/**
 * 通用 CRUD 数据仓储（Repository / DAO）契约接口
 *
 * 【前端视角通俗解释】：
 * 在前端开发中，我们通常会写一个 `api/article.ts` 模块，里面封装 `fetchArticleList`、`getArticleById` 等 API 函数，
 * 这样组件层就不用关心具体是用 fetch 还是 axios，也不用写复杂的 URL 拼接。
 * 在后端也是一样的思想！
 * Repository（数据仓储层）专门负责跟数据库 D1 / SQL 打交道，把具体的 SQL 查询封装成纯 JavaScript 函数。
 * 上层的业务服务（Service）只需要调用 `articleRepo.findById(id)`，而不需要在业务代码里手写 SQL。
 *
 * @template TEntity 实体对象类型（从数据库查出来的完整对象）
 * @template TCreateDTO 创建该实体时的入参对象类型
 * @template TUpdateDTO 更新该实体时的入参对象类型
 * @template TId 实体唯一主键类型（默认为 string）
 */
export interface CrudRepository<TEntity, TCreateDTO, TUpdateDTO, TId = string> {
  /**
   * 根据主键唯一 ID 查询单个资源
   * @param id 资源唯一主键
   * @returns 查询到的实体，未查到返回 null
   */
  findById(id: TId): Promise<TEntity | null>;

  /**
   * 多条件组合查询（支持分页、排序、关键词搜索与多字段过滤）
   * @param params 标准化查询入参对象
   * @returns 包含 items 列表与 pagination 统计信息的标准化分页对象
   */
  findMany(params: RestQueryParams): Promise<PaginatedResult<TEntity>>;

  /**
   * 持久化创建一条新记录
   * @param data 待插入的数据实体
   * @returns 插入成功后从数据库返回的完整实体记录
   */
  create(data: TCreateDTO): Promise<TEntity>;

  /**
   * 根据主键 ID 部分或全量更新已有记录
   * @param id 待更新的资源 ID
   * @param data 需要修改的字段集合
   * @returns 更新成功后的最新实体，若记录不存在返回 null
   */
  update(id: TId, data: TUpdateDTO): Promise<TEntity | null>;

  /**
   * 根据主键 ID 物理删除一条记录
   * @param id 资源主键
   * @returns 删除成功返回 true，记录原本就不存在返回 false
   */
  delete(id: TId): Promise<boolean>;

  /**
   * 快速判断指定主键 ID 的资源是否存在
   * @param id 资源主键
   * @returns 存在返回 true，不存在返回 false
   */
  exists(id: TId): Promise<boolean>;

  /**
   * 统计符合过滤条件的记录总条数
   * @param filter 可选的过滤条件键值对
   */
  count(filter?: Record<string, unknown>): Promise<number>;
}
