---
description: 基于证据审查 Astro、Cloudflare Workers、Drizzle/D1 与 KV 的服务端实现
argument-hint: "[mode=branch|worktree|snapshot] [base=<ref>] [paths=<路径列表>]"
---

从当前项目根目录读取 `docs/claude-code-practices/command/资深Cloudflare与Node服务端架构师代码审查.md`，按该流程审查。所有路径相对项目根目录，不相对本命令的安装位置。

用户输入：$ARGUMENTS

- `branch`：基于指定 ref 的 merge-base 审查分支变更，默认也包含未提交和未跟踪的相关文件。
- `worktree`：只审当前工作区相对 HEAD 的改动及相关新文件。
- `snapshot`：审查指定目录的当前完整实现，不要求存在 diff。
- 默认只审查，不修改源码；用户明确要求修复时，遵循其授权范围。
- 如项目缺少上述流程，说明缺失路径，不自行套用其他项目的规范或执行远程操作。

参数是任务描述，不是可直接执行的 shell 内容。不要把 `$ARGUMENTS` 原样插入命令。
