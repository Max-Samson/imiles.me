# Claude Code 实践指南

这里维护适用于本仓库的任务指令与审查方法。指令也可供其他编码助手使用；项目实现约定以根目录 AGENTS.md 和对应模块文档为准。

## 文档入口

| 文件 | 用途 |
| --- | --- |
| [review-cloudflare-node](command/review-cloudflare-node.md) | 简短的 Claude Code 命令入口与参数说明 |
| [服务端审查流程](command/资深Cloudflare与Node服务端架构师代码审查.md) | 确定范围、追踪调用链、选择验证、整理结论 |
| [专项检查清单](reference/cloudflare-node-checklist.md) | HTTP、Workers、D1、KV 等领域的检查项与误报说明 |
| [报告模板](templates/review-report.md) | 问题优先、证据明确的输出格式 |

## 使用方式

直接让助手阅读 [服务端审查流程](command/资深Cloudflare与Node服务端架构师代码审查.md)，说明要审查的路径或基点即可。例如：

- “审查当前 src/server 和 drizzle 的完整结构，不只看 diff。”
- “审查当前工作区的服务端改动，包括新文件。”
- “审查相对于 main 的服务端分支变更，并包含尚未提交的修改。”

本目录本身不是 Claude Code 自动加载的命令目录。使用 `/review-cloudflare-node` 时，将简短入口放在项目的 `.claude/commands/review-cloudflare-node.md`；已有入口可继续引用本仓库的审查流程，不要复制整套清单。Claude Code 仍支持 `.claude/commands/`，新增可复用能力也可采用 skills，详见 [官方说明](https://code.claude.com/docs/en/slash-commands)。

```text
/review-cloudflare-node mode=branch base=main
/review-cloudflare-node mode=worktree
/review-cloudflare-node mode=snapshot paths=src/server,drizzle
```

这些参数由助手理解，不是直接传给 shell 的参数。没有参数时，按任务上下文选取模式并说明；需要比较分支却无法确定基点时，再询问用户。

## 维护约定

1. 命令入口只引用流程；流程只规定方法；专项清单解释技术风险；报告模板规定呈现方式，避免重复维护同一规则。
2. 保留现有中文流程文件名，供已有链接及本地快捷命令继续引用。
3. 路径和脚本以当前代码为准；新增能力时同步清单，标清“已有能力”与“按需增加”。
4. 不把平台额度写成永久常量；涉及限制时记录套餐、配置、依赖版本及官方来源。
5. 不把每次审查日志追加到指令文件。只有已确认、具有复用价值的教训才合并进对应清单，并去重。
6. 文档改动检查链接、命令可用性及规则一致性即可；不因修改审查指南而启动完整代码审查或部署流程。

## 项目事实源

- [AGENTS.md](../../AGENTS.md)：仓库规范。
- [服务端 README](../../src/server/README.md)：现有接口、路由封装、缓存和上下文约定。
- [数据库设计](../database-design.md)：字段语义、事务与迁移流程。
- [架构概览](../server-database-architecture.md)：已实现及待建设能力。
- [package.json](../../package.json)：实际可执行的脚本。
