# Cloudflare 与 Astro 服务端审查流程

目标：发现会影响行为、数据正确性、安全性、可维护性或发布的具体问题，并给出可验证的改进建议。适用于本仓库的 Workers、Drizzle/D1、KV 和 API；R2、队列等只在实际接入时检查。

默认只读审查。用户要求修复时才修改源码，保留其已有改动；本流程不会自动授权部署、远程迁移、清库或其他远程写入。

## 1. 先确定审查对象

读取根目录 AGENTS.md、[服务端规范](../../../src/server/README.md)、[数据库约定](../../database-design.md) 和 package.json，确认当前实现与实际脚本。用户本次范围优先，不强行将整目录审查改成分支 diff。

| 模式 | 审查对象 | 适用请求 |
| --- | --- | --- |
| branch | 目标基点至 HEAD 的分支变更，加当前未提交/未跟踪的相关改动 | PR、分支、相对某个 ref 的审查 |
| worktree | HEAD 至当前工作区的已跟踪改动，以及未跟踪的相关文件 | “审查当前修改” |
| snapshot | 指定目录当前完整实现及其必要依赖 | “结构是否完整”“审查当前服务端” |

用户明确要求只审提交或暂存区时按其要求执行，并记录未覆盖部分。未指定模式时先根据上下文判断，开头说明范围；只有无法确定且会影响结论时才询问。

### 收集清单

以下命令均在仓库根目录运行；不要输出本地密钥文件的内容。

```bash
git status --short
git diff --name-status HEAD
git ls-files --others --exclude-standard
```

branch 模式另外验证用户提供的 ref。下面以 `main` 为例，不能不经判断就假定项目一定有 main：

```bash
git rev-parse --verify 'main^{commit}'
git merge-base main HEAD
git diff --name-status --find-renames main...HEAD
git log --oneline main...HEAD --right-only
```

记录解析后的基点/HEAD SHA。实际读取 diff 时使用已记录的 SHA，防止审查期间分支移动。结合 `git diff HEAD` 检查未提交内容；不要把 `git diff main` 与 merge-base diff 混为一谈。

snapshot 模式使用 `rg --files <已确认存在的目录>`，读取完整文件，无需寻找“非空 diff”。没有业务表或业务端点时，说明脚手架现状，不虚构业务缺陷。

### 范围与依赖

通常覆盖 `src/server/`、`src/pages/api/`、`drizzle/`，以及与变更有关的 Wrangler/Astro 配置、环境类型、生成脚本、测试、package.json 和 lockfile。SSR 页面、定时任务、队列入口存在依赖时也要追踪。

- 同时处理新增、删除、重命名和未跟踪文件。删除文件从 Git 历史读取，不能直接打开已不存在的工作区路径。
- 自动处理文件列表时使用 NUL 分隔（Git 的 `-z`）；避免空列表或带空格路径经过 `xargs grep` 误扫整个目录。
- 不自动读取 `.dev.vars` / `.env` 值；只确认忽略规则、配置来源及变量名。疑似泄漏报告需脱敏。
- 明确变更问题、既有问题、未验证风险和设计建议。既有问题是否属于本次任务，按用户范围决定。

## 2. 扫描线索，再追到行为

使用 [专项检查清单](../reference/cloudflare-node-checklist.md) 检查所有适用领域。先检索入口，再读完整函数和调用方；正则命中不是缺陷判定。

以下是当前目录存在时可用的检索示例。branch/worktree 模式应结合文件清单定位变更，并扩展到相关依赖；snapshot 模式覆盖所选目录。

```bash
rg -n -g '*.ts' -e 'process\.env' -e 'waitUntil|\.defer\(' -e 'void |\.then\(' src/server src/pages/api
rg -n -g '*.ts' -e 'as any|as unknown as|@ts-ignore' -e 'sql\.raw|\.transaction\(' src/server src/pages/api
rg -n -g '*.ts' -e 'fetch\(' -e 'arrayBuffer\(|request\.json\(' -e 'new Map|^let |^var ' src/server src/pages/api
rg -n -g '*.ts' 'from.*(repositories|server/db|drizzle-orm)' src/pages/api
```

`rg` 返回 1 表示没有匹配，返回 2 表示执行错误；不要用 `2>/dev/null` 或 `|| true` 隐藏后者。新功能目录尚不存在时跳过并标注不适用。

重点辨别以下误报：

- `sql` 模板插值通常是参数化查询，不能据此认定 SQL 注入；应追查 `sql.raw` 和动态标识符来源。
- `fetch` 的 signal 可能由多行选项或封装函数传入；同一行没有 signal 不是缺失超时的证据。
- `process.env` 在受控本地回退或构建脚本中可能合理；看运行环境及输入来源。
- `const new Map()` 也可能包含共享可变状态；只找顶层 let/var 不足以证明没有串态。
- Node 模块需按 Workers 兼容日期、标志和实际 API 支持判断，不将全部 `node:` 导入一律判错。
- 扫描零命中不能证明没有漏洞；修复验证必须包含触发场景。

### 调用链分析

对受影响入口追踪至 D1/KV/R2/外部 HTTP 叶子节点，覆盖成功、校验失败、业务失败、基础设施故障及适用的超时/后台分支。复杂链路绘图，简单函数用短说明即可。

示例是“写操作必须完成后返回成功”的业务，不代表项目已实现留言功能：

```text
POST 资源
  → defineRestRoute：请求 ID、异常出口
  → readJsonBody + schema：无效请求返回 400/413/415
  → Service：身份/权限、业务规则、幂等要求
  → Repository：参数化 D1 写入并 await
      ├─ 写失败 → 脱敏 5xx，不返回成功
      └─ 写成功 → KV 失效（按业务处理失败与陈旧窗口）
  → 201 + Location
```

`ctx.defer` / `waitUntil` 适合允许失败的辅助工作，不是“数据库写入一定完成”的保证。不要把缓存命中当作跳过业务写入的理由。

## 3. 按风险选择验证

先确认 package.json 中脚本存在。验证失败要读实际输出，不只看退出码；失败、未执行、不适用分别记录。测试工具缺失、内存耗尽、权限或网络限制均不能记为通过。

| 变更类别 | 必要验证 | 按涉及内容补充 |
| --- | --- | --- |
| 仅文档 | 相对链接、示例路径、脚本名和规则一致性 | shell 示例语法检查；无需完整构建 |
| 服务端逻辑/公共工具 | 相关 Biome 检查、`pnpm check:server`、`pnpm test:server` | 针对已确认缺陷补充回归用例 |
| API/Astro 接入 | 上述检查及 `pnpm build` | 本地 HTTP 验证实际框架行为 |
| D1 schema/迁移 | 服务端检查、`pnpm db:check` | 临时本地库执行真实 SQL、历史数据兼容及约束测试 |
| 绑定/部署配置/打包依赖 | `pnpm build`、`pnpm exec wrangler deploy --dry-run` | 绑定类型对照、本地 Worker 验证 |
| 跨前后端契约 | 相关检查及 `pnpm check` | 前端调用、SSR 与错误契约验证 |

完整服务端 snapshot 审查应运行服务端检查、测试和构建；全站检查在涉及共享契约或用户要求完整验收时执行。提交前按仓库要求运行 `pnpm lint`、`pnpm format:check`。

### 验证边界

- 本项目 `test:server` 的 D1/KV 仿真使用 `persist:false`、`remoteBindings:false`。检查测试配置后再运行，避免使用已有本地业务库。
- `pnpm db:check` 检查迁移元数据，不会执行 SQL；journal 为空时通过不能证明业务数据库可用。
- 需要验证迁移时，在临时持久化目录执行 `pnpm exec wrangler d1 migrations apply BLOG-DB --local --persist-to <临时目录>`。没有 SQL 时标记不适用。
- `cf:types`、`db:generate` 会修改生成文件。只读审查先对照配置与类型；需要重生成验证时使用隔离副本，不覆盖工作区改动。
- `dry-run` 不验证远程资源存在、权限或线上迁移状态；真实 ID 出现在配置中也不等于线上就绪。
- `health` 仅证明进程能响应。探针成功不能替代 D1/KV 功能测试。
- 本地 KV 测试不能证明全球读写立即一致；外部 API 测试要区分 mock 与真实端到端结果。
- Astro 内置来源校验可能在路由之前返回 403；不能为统一响应格式而关闭保护。
- 同一轮检查成功后，只有代码变化、新失败或新风险才重跑。内存耗尽时记录限制，保留独立服务端检查结果，不无限提高内存重试。
- 纯审查不强制新增测试文件；可用临时复现提供证据。用户要求修复时，为有实际风险的缺陷保留回归测试。

## 4. 形成可行动结论

按 [报告模板](../templates/review-report.md) 输出，发现的问题放在前面。每项应包含当前文件行号、触发条件、可观察影响、证据与建议；同一根因的多个表现合并报告，列出受影响位置。

| 严重度 | 判定依据 |
| --- | --- |
| Critical | 有明确证据的严重越权、秘密泄漏、不可恢复数据损失等紧急风险 |
| High | 常见路径会失败，或明确阻止安全发布/关键业务正确性 |
| Medium | 特定输入、故障或并发条件下产生可复现错误 |
| Low | 影响有限的兼容性或维护问题 |

严重度结合真实可达路径和现有控制评估。尚未被调用的基础工具缺陷应说明接入条件，不描述成线上事故；仅依赖假设的风险单独列出，不冒充已确认发现。

结束前核对：所选范围全部覆盖、命中线索有判断、问题关联到行为、测试结果来源明确、未验证项没有被隐藏。无问题时写“在上述范围内未发现可确认问题”，不宣称绝对安全。

branch/worktree 模式给出是否建议合并及阻塞项；snapshot 模式给出当前成熟度与优先补齐事项。不要向没有 PR 的任务套用“拒绝合并”。
