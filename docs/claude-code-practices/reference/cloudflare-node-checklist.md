# 服务端专项检查清单

配合 [审查流程](../command/资深Cloudflare与Node服务端架构师代码审查.md) 使用。只检查范围内适用的条目；没有接入的能力标记不适用，不为目录齐全制造空实现。

## 项目约定与当前能力

以 [服务端 README](../../../src/server/README.md) 和 [数据库设计](../../database-design.md) 为实现事实源。当前已有 `defineRestRoute`、`readJsonBody`、`parseRestQuery`、`getOrLoadCache`、`ctx.defer`、审计字段构造器和本地测试；这些工具的存在不证明所有调用方都使用正确。

### HTTP 与请求上下文

- 是否通过 `defineRestRoute` 统一处理方法、405/Allow、HEAD、OPTIONS、请求 ID 与异常？手动处理时是否覆盖同等分支？
- JSON 是否按实际流大小限制，而非仅信任 Content-Length？413、415、JSON 语法错误、Zod 字段错误是否区分？
- 路径、查询和请求体是否在使用前校验？`as DTO` 和泛型不会执行运行时校验。
- page/offset 是否在安全整数与业务上限内？重复参数、过滤字段、排序字段和投影字段是否明确处理？游标分页是否真实实现？
- 201 是否附 Location，204/HEAD/304 是否正确处理无实体语义？GET 是否无业务写副作用？
- 5xx 是否统一脱敏，内部日志和客户端响应是否能通过 requestId 关联？AppError 子类是否绕过了脱敏？
- 是否误信任客户端 X-Request-Id / X-Forwarded-For？代理信任边界是否与部署方式一致？
- `/api/v1/health` 是存活探针，不能证明依赖就绪或鉴权正确。

### CORS、身份与权限

- 无跨域需求时是否保持同源默认？启用凭据时是否显式来源白名单，避免任意 Origin 反射？
- 是否正确合并 `Vary: Origin`，覆盖拒绝来源、无 Origin 和已有 Vary 的响应？
- 预检是否匹配实际路由方法、请求头？已进入处理器的错误分支是否保持 CORS？
- CORS 不是鉴权；使用 Cookie 的写操作是否有适用的 CSRF 防护？不要误删 Astro 自身的来源检查。
- 单项和批量写操作是否都检查身份、资源所有权与状态转换？不可猜测 ID 不能替代授权。
- 严格限流、准确计数、幂等锁是否依赖具备对应一致性保证的机制，而非 KV 的非原子读改写？
- 响应、日志、缓存 key 是否泄漏凭据、原始 IP 或个人数据？输入是否可能放大日志体积？

### Workers 生命周期与外部 I/O

- 是否把请求级用户信息或绑定句柄存入跨请求可变状态？共享缓存是否有范围、上限和失效规则？
- 正确性关键写入是否在返回成功前 await？允许失败的任务是否由绑定后的 waitUntil 或 `ctx.defer` 管理？
- waitUntil 有生命周期限制，不等于可靠队列；需要重试/持久执行的流程是否设计了幂等与恢复？参见 [上下文 API](https://developers.cloudflare.com/workers/runtime-apis/context/)。
- 是否区分 CPU 执行时间与 I/O 等待的墙钟时间？N+1 会增加延迟和调用量，但不能仅按网络等待推断 CPU 超限。
- CPU、内存、subrequest 等预算是否对应实际套餐、配置和兼容日期？不要把某个固定数字作为所有部署的通用上限。[平台限制](https://developers.cloudflare.com/workers/platform/limits/)
- Node API 是否在当前运行时受到支持？构建工具使用 fs 与 Worker 请求路径使用 fs 需要分别判断。[Node 兼容性](https://developers.cloudflare.com/workers/runtime-apis/nodejs/)
- 外部 fetch 是否处理非 2xx、超时、取消、响应大小及流释放？重试是否会重复非幂等写入？URL 来自用户时是否存在 SSRF 路径？
- 无 runtime 的测试/构建上下文是否有适当回退？依赖 DB 的路径是否明确报告缺失绑定，而非默默忽略持久化？

### Drizzle、D1 与数据约束

- 表/列类型、唯一约束、外键、CHECK 与业务不变量是否一致？不能仅依赖“先查再写”防并发冲突。
- SQL 值是否参数化，动态字段是否映射到固定列？`sql` 标签插值通常安全，`sql.raw` 和字符串拼接需要追溯来源。
- 计数/扣减是否原子更新？多步写入是否需要 batch？影响零行是否被正确当作业务失败或正常未命中？
- D1 batch 的 SQL 错误会回滚整批，但业务条件不成立不一定抛 SQL 错误；不能把“未报错”等同于“业务成功”。[D1 batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)
- 当前毫秒时间戳使用 number，是否与 `timestamp_ms` 的 Date 模式混用？
- `$defaultFn` / `$onUpdateFn` 是 ORM 运行时行为，原生 SQL、迁移和批处理是否显式处理 ID 与审计字段？[Drizzle 列定义](https://orm.drizzle.team/docs/sqlite/column-types)
- 软删除是否在相关查询中实际过滤？与唯一索引、恢复、级联关系如何协作？
- 查询是否有适用的上限、稳定排序和索引？按访问模式/查询计划检查，而不是要求每个字段都有索引或每条聚合 SQL 都加 LIMIT。
- 错误原因是否保留在内部日志/cause，且不向客户端暴露 SQL、表名、路径或绑定细节？

### 迁移与发布兼容性

- schema 导出、SQL、快照和 journal 是否一致，Drizzle 输出目录是否与 Wrangler migrations_dir 对齐？
- 真正的迁移是否在临时本地数据库上执行过？空 journal 或 db:check 通过不提供业务结构验证。
- 新 NOT NULL 列对旧行如何回填？SQL 默认值、应用默认值和回填步骤是否被混淆？
- 新旧代码共存时是否兼容？涉及删除/重命名时是否需要分阶段迁移？
- 不要求每个受迁移管理器追踪的脚本都可任意重复执行；重点检查迁移顺序、失败恢复与数据保留。
- 代码回滚不自动恢复数据；破坏性迁移是否有可执行的备份/恢复方案？审查本身不执行远程迁移。

### KV 与 HTTP 缓存

- KV 是否仅保存允许短期陈旧或丢失的缓存？最终一致性不能保证跨区域立即读到刚写入或刚删除的值。[KV 一致性](https://developers.cloudflare.com/kv/concepts/how-kv-works/)
- TTL 是否有限且有效？当前工具默认 300 秒、正整数不足 60 时提升到 60；这些行为应通过实现和测试核对。
- 当前 1 MiB JSON 限制是项目预算，不能描述为 KV 平台单值上限。[KV 写入规则](https://developers.cloudflare.com/kv/api/write-key-value-pairs/)
- 缓存是否经过运行时解码？格式变更、未命中、读取失败是否回源？权威数据源失败是否仍会抛出？
- KV 写入/失效失败是否可观察？缓存失败与业务写入失败的响应语义是否区分？
- Cache-Control 是否与数据敏感度匹配？s-maxage 不会自动将 Worker 响应放入边缘缓存，需确认实际缓存机制。
- ETag 是否覆盖实际表示？响应中有动态 timestamp 时，按业务版本生成的标签不应冒充字节相同的强 ETag。
- If-None-Match 是否正确弱比较并处理多个标签？304 是否保留与 200 一致的 Cache-Control/Vary 等头？[条件请求规则](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/If-None-Match)

### 部署配置与生成文件

- D1 database_id、KV id 是否为目标资源 ID，绑定名是否与代码一致？配置正确不等于远程资源或权限已验证。
- 本地测试是否关闭远程绑定，使用临时数据？预览/测试环境是否意外复用生产资源？
- Secrets 是否来自安全配置，未写入仓库？报告只展示变量名和脱敏证据。
- 绑定变更是否同步生成类型？`cf:types` 会写文件，纯审查不要覆盖用户已有改动。
- 兼容日期、nodejs_compat、静态资产路由、构建入口是否与项目实际运行方式一致？
- Biome/类型检查是否排除生成缓存目录？构建、测试、dry-run 的成功分别只能证明其覆盖的环节。

### 按需检查：R2、队列与定时任务

- 上传/下载是否有鉴权、文件类型和大小限制、路径约束与流式处理？签名链接权限和有效期是否合适？
- 队列消费者是否处理重复投递、部分失败、重试与死信？定时任务是否允许重叠执行？
- 上述功能尚未接入时，不把缺少对应目录视为当前缺陷。
