# 后台管理平台基础架构：Cloudflare Access、Astro、React 与 Workers

状态：架构设计已确认；Phase 1 至 Phase 3 已于 2026-09-26 实现。生产 KV、Worker Secrets 和 Turnstile 已配置；Access 路径收窄、精确邮箱策略、生产 D1 迁移和部署链路去重仍待完成。本文既记录目标架构，也记录 2026-09-26 的 Cloudflare 实际配置状态，便于部署复核和后续维护。

## 0. 生产 Cloudflare 配置记录

本节是当前生产配置的事实记录。后续章节说明设计原则和标准操作流程；两者冲突时，应先确认本节的“当前状态”和“待完成项”，再修改控制台或代码。

### 0.1 账号、站点与 Worker

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| Cloudflare Account ID | 从 Dashboard 或 `wrangler whoami` 获取 | 不写入公开文档 |
| Account display name | 仅在 Dashboard 核对 | 不写入公开文档 |
| 主域名 | `imiles.me` | 已接入 Cloudflare |
| Worker name | 从本地 `.env` 的 `CLOUDFLARE_WORKER_NAME` 获取 | 不写入公开文档 |
| Production route | `imiles.me`，Custom Domain | `wrangler.toml` 已声明 |
| `workers.dev` | `false` | 已在 `wrangler.toml` 显式关闭 |
| Preview URLs | `false` | 已在 `wrangler.toml` 显式关闭 |
| Worker compatibility date | `2026-03-31` | 已配置 |
| Compatibility flags | `nodejs_compat` | 已配置 |
| Worker assets | `dist/`，binding 为 `ASSETS` | 已配置 |

生产部署以仓库根目录的 `wrangler.toml` 为资源声明来源。Dashboard 中由旧版本保留的 binding 名称不代表下一次 Wrangler 部署后的最终状态。

### 0.2 Cloudflare Access 应用

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| Application name | 从本地 `.env` 的 `CLOUDFLARE_ACCESS_APPLICATION_NAME` 获取 | 不写入公开文档 |
| Application type | Self-hosted | 已创建 |
| Application ID | 从 Access Application 页面获取 | 不写入公开文档 |
| Access team domain | `<ACCESS_TEAM_NAME>.cloudflareaccess.com` | 实际值只存环境配置 |
| Issuer | `https://<ACCESS_TEAM_NAME>.cloudflareaccess.com` | 已部署为 Worker Secret |
| Audience tag | 已保存到 `ACCESS_AUD` | 已部署，文档不记录完整值 |
| Application session duration | `6 hours` | 已确认 |
| Accept all identity providers | On | 当前控制台状态 |
| Instant authentication | Off | 当前控制台状态 |
| Cloudflare One Client authentication | Off | 当前控制台状态 |

Access 编辑页当前包含以下四个 Public hostname/path：

```text
imiles.me/admin
imiles.me/admin/*
imiles.me/api/v1/admin
imiles.me/api/v1/admin/*
```

路径输入框不包含开头的 `/`，Dashboard 组合 `Domain + Path` 后形成上述完整路径。根路径和通配路径必须同时保留，因为 `admin/*` 不覆盖 `/admin` 本身，`api/v1/admin/*` 也不覆盖 `/api/v1/admin` 本身。

当前仍存在一个额外的 Workers Scope：

```text
Worker: <WORKER_NAME>
Type: A Worker's production and preview URLs
```

该 Scope 会把整个 Worker 作为 Access 目标，范围大于后台路径。它必须在最终保存前移除，否则公开博客也可能被 Access 登录页拦截。四条 Public hostname/path 已出现在编辑页，但当前尚未完成“移除 Worker Scope 后点击 Save”的最终操作，因此上线验收时必须以匿名访问公开页面和 Access authentication logs 为准，不能只依据编辑页内容判断生效。

### 0.3 Access 管理员策略

目标管理员使用精确邮箱白名单，真实邮箱只保存在 Access Policy 和 Worker Secret 中：

```text
<ADMIN_EMAIL_1>
<ADMIN_EMAIL_2>
```

控制台当前关联了两条 Allow Policy：

```text
Email domain: <ADMIN_EMAIL_1>
Email domain: <ADMIN_EMAIL_2>
```

这两条策略当前使用的是 `Emails ending in` / email domain 语义，名称和 selector 均不符合目标配置。最终配置应使用精确的 `Emails` selector，可以合并成一条 reusable policy：

```text
Policy name: imiles-admin-owners
Action: Allow
Include: Emails
Values:
  <ADMIN_EMAIL_1>
  <ADMIN_EMAIL_2>
```

修改 Access 管理员时，必须同步修改 Worker Secret `ADMIN_EMAILS`。Access Policy 是边缘入口授权，`ADMIN_EMAILS` 是 Worker 内第二层授权；任一处未包含该邮箱都会拒绝访问。

Additional settings 已确认采用以下值：

| 设置 | 值 | 原因 |
| --- | --- | --- |
| HttpOnly | On | 防止浏览器脚本读取 Access Cookie |
| Cookie Path Attribute | Off | `/admin` 页面和 `/api/v1/admin` API 共用 Cookie |
| CORS bypass | Off | 后台只使用同源请求 |
| Allow Credentials | Off | 未启用跨域凭据请求 |
| Binding Cookie | Off | 首版不绑定额外客户端状态 |
| Service Auth 401 behavior | Off | 当前没有面向机器客户端的 Access Service Token 流程 |

### 0.4 Worker Secrets

生产 Worker 当前共有以下 Secret。值只保存在 Cloudflare 加密存储和本地被 Git 忽略的环境文件中，不写入本文、Git、日志或截图。

| Secret 名称 | 用途 | 状态 |
| --- | --- | --- |
| `ENVIRONMENT` | 生产环境标识，生产值为 `production` | 已部署 |
| `ACCESS_ISSUER` | Access JWT issuer | 已部署 |
| `ACCESS_AUD` | Access Application audience | 已部署 |
| `ADMIN_EMAILS` | Worker 内精确管理员 allowlist | 已部署 |
| `SUBMISSION_HMAC_SECRET` | 友链申请相关 HMAC | 已部署，随机 256-bit 值 |
| `TURNSTILE_SITE_KEY` | 友链申请页加载 Turnstile Widget | 已部署 |
| `TURNSTILE_SECRET_KEY` | 服务端调用 Turnstile Siteverify | 已部署 |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase Storage S3 访问标识 | 原有 Secret，已保留 |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | Supabase Storage S3 私钥 | 原有 Secret，已保留 |

所有新增变量都使用 Secret 类型。这样后续 Dashboard 不会显示明文，也避免未写入 `wrangler.toml` 的普通变量在部署时发生意外覆盖。新增两批 Secret 分别触发了 Worker version 部署：第一批为 Access/HMAC 五项，第二批为 Turnstile 两项。

当前未配置以下可选变量：

- `ADMIN_SERVICE_TOKEN_IDS`
- `ADMIN_SERVICE_TOKEN_CAPABILITIES`
- `SITE_URL`，生产使用代码默认的 `https://imiles.me`
- Supabase endpoint、region 和 bucket 覆盖值，当前使用代码中的生产默认值

### 0.5 Turnstile Widget

| 项目 | 当前值 | 状态 |
| --- | --- | --- |
| Widget name | 从本地 `.env` 的 `CLOUDFLARE_TURNSTILE_WIDGET_NAME` 获取 | 不写入公开文档 |
| Mode | Managed | 已配置 |
| Production hostname | `imiles.me` | 已配置 |
| Local hostname | `localhost` | 尚未确认加入 |
| Pre-clearance | Off | 已配置 |
| Site key | 已保存到本地 `.env` 和 Worker Secret | 不在文档记录值 |
| Secret key | 已保存到本地 `.env` 和 Worker Secret | 不在文档记录值 |
| 前端 action | `friend_link_submit` | 由应用代码固定 |

创建 Widget 时确认生效的 hostname 是 `imiles.me`。`localhost` 输入未形成已选 hostname，因此本地真实 Widget 联调前必须选择以下一种方式：

1. 在该 Widget 的 Hostname Management 中补充 `localhost`；或
2. 本地使用 Cloudflare 官方测试 Site Key/Secret Key，生产继续使用当前 Widget。

生产服务端必须同时验证：

- `success === true`
- `hostname === "imiles.me"`
- `action === "friend_link_submit"`

不要只根据客户端组件显示成功判断申请可信。

### 0.6 D1、KV、Rate Limiter 与 Assets

| Worker binding | Cloudflare 资源 | 资源标识 | 当前状态 |
| --- | --- | --- | --- |
| `DB` | 生产 D1 | ID 从 `wrangler.toml` 或 Dashboard 核对 | `wrangler.toml` 已声明；生产迁移待执行 |
| `KV` | 业务 KV | ID 从 `wrangler.toml` 或 Dashboard 核对 | `wrangler.toml` 已声明 |
| `SESSION` | 独立 Session KV | ID 从 `wrangler.toml` 或 Dashboard 核对 | Namespace 已创建并写入配置 |
| `FRIEND_LINK_RATE_LIMITER` | Workers Rate Limiting | namespace `1001`，5 requests / 60s | `wrangler.toml` 已声明 |
| `ASSETS` | Worker static assets | `dist/` | 已声明 |

Dashboard 当前生产版本仍显示旧 binding 名称：

```text
D1: <LEGACY_D1_BINDING_NAME>
KV: <LEGACY_KV_BINDING_NAME>
```

应用代码读取的是 `env.DB`、`env.KV` 和 `env.SESSION`。下一次执行仓库中的 `wrangler deploy` 后，Wrangler 应按 `wrangler.toml` 把 binding 名称更新为 `DB`、`KV`、`SESSION`。在这次代码部署完成前，不应把 Dashboard 的旧 binding 列表当作新后台已具备完整运行条件。

生产 D1 当前尚未应用友链迁移。迁移文件：

```text
drizzle/migrations/0000_friend_links.sql
```

必须使用目标账号执行：

```bash
pnpm exec wrangler whoami
pnpm exec wrangler d1 migrations list <D1_DATABASE_NAME> --remote
pnpm exec wrangler d1 migrations apply <D1_DATABASE_NAME> --remote
```

`whoami` 必须显示与生产资源所属账号一致的 Account ID。当前本机 Wrangler OAuth 曾登录到其他账号，因此在身份未切换前不要执行 `--remote`。不建议直接在 Dashboard SQL Console 粘贴迁移 SQL，因为这会绕过 Wrangler migration bookkeeping，后续迁移可能重复执行。

### 0.7 本地环境文件

本地 `.env` 已设置为文件权限 `0600`，并被 `.gitignore` 忽略。它包含以下名称：

```text
ENVIRONMENT=development
ACCESS_ISSUER
ACCESS_AUD
ADMIN_EMAILS
SUBMISSION_HMAC_SECRET
TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
SUPABASE_S3_ACCESS_KEY_ID
SUPABASE_S3_SECRET_ACCESS_KEY
SUPABASE_PROJECT_REF
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_WORKER_NAME
CLOUDFLARE_ACCESS_TEAM_NAME
CLOUDFLARE_ACCESS_APPLICATION_ID
CLOUDFLARE_ACCESS_APPLICATION_NAME
CLOUDFLARE_D1_DATABASE_NAME
CLOUDFLARE_D1_DATABASE_ID
CLOUDFLARE_KV_NAMESPACE_NAME
CLOUDFLARE_KV_NAMESPACE_ID
CLOUDFLARE_SESSION_KV_NAMESPACE_NAME
CLOUDFLARE_SESSION_KV_NAMESPACE_ID
CLOUDFLARE_TURNSTILE_WIDGET_NAME
CLOUDFLARE_BUILD_API_TOKEN_NAME
```

前半部分变量供应用运行时使用；`CLOUDFLARE_*` 变量只是本地运维元数据，不会因为写入 `.env` 自动成为 Worker binding，也不会暴露给 Astro 客户端。真实值不得复制到文档、Issue、PR 描述或终端输出。临时批量导入文件位于：

```text
/tmp/imiles-worker-secrets.env
```

所有线上 Secret 完成核对后应删除该临时文件。`.env` 可以继续用于本地开发，但不能提交。

### 0.8 构建与部署链路

Cloudflare Builds 当前配置：

| 项目 | 当前值 |
| --- | --- |
| Git repository | `Max-Samson/imiles.me` |
| Production branch | `master` |
| Build command | `pnpm run build` |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| API token | 使用专用、最小权限的构建 Token；名称不写入公开文档 |
| Build cache | On |
| Include paths | `*` |

仓库同时存在 `.github/workflows/deploy.yml`，它也会在 `main` 或 `master` push 后执行构建和 `wrangler deploy`。因此当前一次 `master` push 可能触发 Cloudflare Builds 和 GitHub Actions 两次部署。

上线前必须保留唯一生产部署入口。当前推荐保留 GitHub Actions，因为流程、Node/pnpm 版本和并发取消策略都在仓库中可审计，然后在 Cloudflare Worker Settings → Builds 中断开 Git repository。若决定保留 Cloudflare Builds，则应停用 GitHub Actions 的 push 部署触发器。不要长期保留双部署链路。

### 0.9 已完成的部署前验证

2026-09-26 已执行：

```bash
pnpm cf:types
pnpm check:server
pnpm build
pnpm exec wrangler deploy --dry-run
```

结果：

- Cloudflare binding 类型生成成功，`WorkerBindings` 已包含 `SESSION`。
- 服务端 TypeScript 检查通过。
- Astro 生产构建通过，`/admin/index.html` 为预渲染静态页面。
- `AdminApp` 生成独立浏览器 chunk，后台页面不执行 React SSR。
- dry run 成功读取 `DB`、`KV`、`SESSION`、`FRIEND_LINK_RATE_LIMITER` 和 `ASSETS`。
- Wrangler 因沙箱权限无法写入用户 Library 下的 debug log，但类型生成和 dry run 本身成功完成。

### 0.10 当前剩余上线操作

按执行顺序：

1. 在 Access Application 中移除整个 Worker Scope。
2. 把两条 `Email domain` Allow Policy 替换为精确 `Emails` Policy。
3. 点击 Access Application 的 Save，并重新打开页面确认配置持久化。
4. 匿名验证公开首页、博客和友链页不出现 Access 登录。
5. 验证 `/admin`、`/admin/*`、`/api/v1/admin` 和 `/api/v1/admin/*` 会进入 Access 登录。
6. 为 Turnstile 补充 `localhost`，或本地改用官方测试 keys。
7. 切换 Wrangler 到目标 Account ID，应用生产 D1 migration。
8. 在 Cloudflare Builds 与 GitHub Actions 中只保留一个生产部署入口。
9. 推送代码并确认 Wrangler 把生产 bindings 更新为 `DB`、`KV`、`SESSION`。
10. 完成线上后台登录、Session API、友链申请、图片上传、审批和公开展示验收。
11. 删除 `/tmp/imiles-worker-secrets.env`。

## 1. 结论

后台采用以下架构：

```text
Cloudflare Access 托管登录和入口策略
        ↓
预渲染的 Astro 后台 HTML 壳
        ↓
client:only 的 React + shadcn/ui 管理应用
        ↓ same-origin fetch
Astro API Routes on Cloudflare Workers
        ↓
服务端再次验证 Access JWT，并执行应用权限、业务规则与审计
        ↓
D1 / KV / 对象存储等后端资源
```

核心决策：

1. 不开发账号、密码、找回密码、登录表单或应用 Session 服务。
2. Cloudflare Access 是身份认证和边缘入口保护层，不是业务授权层。
3. 所有管理 API 必须在 Worker 内验证 Access JWT，不能只信任请求头存在或 Access 控制台配置。
4. 后台页面使用 `export const prerender = true`，后台 React 根组件使用 `client:only="react"`，不执行后台 SSR。
5. 后台页面不读取管理员身份、不访问数据库，也不向静态 HTML 注入管理数据。
6. 浏览器只使用 Access 的 HttpOnly Cookie，不接触 JWT、Service Token 或其他后台凭据。
7. 本地开发不增加“开发环境自动管理员”或认证绕过；UI、服务端和真实 Access 联调分层完成。
8. 后台框架先稳定落地，具体业务以独立模块接入。

这套方案适合当前个人站点和少量管理员场景。它可以长期扩展为多模块后台，但在真正出现多角色需求前不提前建设复杂 RBAC。

## 2. 当前项目基础与约束

当前项目已经具备：

- Astro 5，`output: 'server'`。
- React 19 islands。
- Tailwind CSS v4 和 shadcn/ui 配置。
- Cloudflare Workers adapter。
- D1、KV 和 Rate Limiter bindings。
- Drizzle ORM 和版本化迁移。
- 统一 REST 路由、错误响应、Request ID、no-store 和请求体限制。
- `jose` JWT 验证。
- 已实现的 Access JWT 签名、issuer、audience、邮箱白名单和 Service Token 验证。
- 私有对象存储及图片服务。

当前构建产物中 `dist/_worker.js` 约 7.4 MiB，包含公开站点的 React SSR、内容模块和较大的 Three.js chunk。后台基础设施不能继续把管理页面、shadcn 组件和业务交互加入 Worker SSR 依赖图。

当前认证实现位于 `src/server/security/access/`，分别负责配置解析、JWT 验证、Actor 映射和能力授权；浏览器写请求的同源校验位于 `src/server/security/origin.ts`。业务模块只调用公开的授权入口，不读取 JWT payload。

## 3. 目标与非目标

### 3.1 目标

- 登录、MFA、Session 生命周期和入口策略由 Cloudflare Access 托管。
- Worker 对每个管理 API 执行最终身份验证和应用授权。
- 本地开发快速，不需要真实 Access 才能开发 UI 或验证业务 Service。
- staging 能完整验证真实登录、Cookie、JWT、D1 和资源绑定。
- 后台 UI 与 Worker SSR 包隔离。
- 新业务模块有统一的 Route、Service、Repository、权限和审计接入方式。
- Cloudflare 控制台和仓库配置边界清晰，可重复检查。
- 默认不缓存任何管理数据或私有媒体。

### 3.2 非目标

- 自建登录系统。
- 在浏览器保存 Access JWT。
- 在 D1 建立用户密码或 Session 表。
- 首版建设组织、团队、邀请、复杂角色继承或权限管理 UI。
- 首版建设图表大屏、可配置工作流或通用低代码平台。
- 使用 Cloudflare Access 登录日志替代业务操作审计。
- 本地伪造一个可部署的“万能管理员”开关。
- 后台页面 SSR 或在 Astro frontmatter 中读取管理数据。

## 4. Cloudflare Access 的职责边界

### 4.1 Access 负责

- 显示登录流程。
- 连接 One-time PIN、GitHub、Google 或其他 IdP。
- 执行允许邮箱、身份提供商、MFA、设备等边缘策略。
- 管理应用 Session 和 `CF_Authorization` Cookie。
- 在允许的请求进入 Worker 时注入 `Cf-Access-Jwt-Assertion`。
- 记录登录成功、失败和策略决策。
- 撤销用户会话。

### 4.2 应用负责

- 验证 JWT 的 RS256 签名。
- 验证 `iss`、`aud`、`exp`、`iat` 和身份 claim。
- 将 Access 身份转换为稳定的应用 Actor。
- 执行管理员 allowlist 或后续角色权限。
- 执行 CSRF / Origin 验证。
- 执行业务状态机、幂等、并发控制和数据约束。
- 记录业务操作审计。
- 对 API 响应和私有媒体设置 no-store。
- 处理 Access Session 过期时的客户端恢复体验。

Cloudflare 明确要求公开可路由的源站验证应用令牌，不能仅检查请求头存在：[Application token](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/application-token/)。

## 5. 可行性、可维护性与稳定性

### 5.1 可行性

当前项目已经部署在 Cloudflare Workers 自定义域名上，Access 可以直接保护公开域名中的指定路径，无需部署 Tunnel。Astro 管理 API 能读取 Cloudflare 注入的请求头，现有 `jose` 代码也已经验证了同类 JWT。

后台页面和 API 都在 `imiles.me` 同源下：

- 不需要 CORS。
- 浏览器自动携带 Access Cookie。
- Service Token 不进入浏览器。
- 当前严格 Origin 检查可以继续使用。
- 管理图片可通过受保护的同源 URL 直接显示。

### 5.2 可维护性

Access 替代的是认证基础设施，不替代应用架构。项目仍保留清晰的服务端边界，未来即使更换认证供应商，也只需要替换 `src/server/security/access`，业务 Service 和 Repository 不应依赖 Access claim 结构。

维护风险主要来自两处：

1. Access 应用、策略、IdP、Session 等配置默认存在 Cloudflare 控制台，可能与仓库文档产生漂移。
2. Worker 环境的 issuer、audience、管理员 allowlist 必须与 Access 应用保持一致。

首版用本文的配置清单和发布验收表管理。后台扩大或管理员增加后，再考虑 Terraform 管理 Access 应用和策略，不在首版同时引入 IaC 复杂度。

### 5.3 稳定性

登录可用性依赖 Cloudflare Access 和所选 IdP。如果选择 One-time PIN，还依赖管理员邮箱接收链路。OTP 代码为单次使用，且邮件安全扫描器可能提前消费链接；Cloudflare提供相应排查说明：[One-time PIN login](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)。

稳定性设计：

- 单管理员首版优先使用 OTP，配置最少。
- 管理频率升高后，可增加 GitHub 或 Google IdP，避免完全依赖邮件验证码。
- 应用 Session 设置为数小时，不使用超长 Session。
- API 遇到缺失或失效 JWT 时失败关闭。
- Access 登录故障不会影响公开站点，只影响 `/admin` 和 `/api/v1/admin`。
- 后台静态壳不包含敏感数据，登录过期后即使壳仍留在浏览器中，API 也不会返回数据。

## 6. 生产路由与 Access 应用设计

使用一个 Self-hosted Access Application，同时加入以下公开 hostname/path：

```text
imiles.me/admin
imiles.me/admin/*
imiles.me/api/v1/admin
imiles.me/api/v1/admin/*
```

必须同时添加根路径和通配路径。Cloudflare 的 `path/*` 不覆盖父路径本身，路径匹配规则见 [Application paths](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)。

使用同一个应用的理由：

- 页面和 API 共用一个 audience。
- Worker 只需配置一个 `ACCESS_AUD`。
- 登录一次后，同域 Cookie 可供页面导航和 API 请求使用。
- 不需要管理两个 Access Session。

Cookie Path Attribute 应关闭，使 `CF_Authorization` Cookie 作用于当前域名，而不是只绑定 `/admin`。否则页面登录后访问 `/api/v1/admin` 可能需要重新认证。Cookie 行为见 [Authorization cookie](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/)。

不配置 Bypass 策略。Access 应用默认拒绝，没有命中 Allow 策略的身份不能进入。

## 7. Cloudflare 完整配置步骤

以下路径名称按当前 Cloudflare Zero Trust 控制台整理，平台改版时以官方文档为准。

### 7.1 创建或确认 Zero Trust 组织

1. 登录 Cloudflare Dashboard。
2. 打开 Zero Trust。
3. 记录 Team name，但不要把生产值提交到公开文档。
4. 记录 Access issuer：

   ```text
   https://<team-name>.cloudflareaccess.com
   ```

5. 确认 `imiles.me` 位于同一 Cloudflare account，并已由 Cloudflare 代理。

### 7.2 配置登录方式

个人站点首版推荐 One-time PIN：

1. Zero Trust → Integrations → Identity providers。
2. Add new identity provider。
3. 选择 One-time PIN。
4. 保存。

OTP 只是登录方式，不能单独作为允许策略。不要创建“Include Login method = One-time PIN”且没有邮箱限制的 Allow policy；这种策略会允许任何能使用该登录方式的人尝试进入。Access 常见错误配置见 [Access policies](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/)。

后续可同时增加 GitHub 或 Google IdP。只有一个 IdP 时可以启用 Instant authentication，直接跳转到该 IdP；多个 IdP 时保留登录方式选择页。

### 7.3 创建精确邮箱策略

1. Zero Trust → Access controls → Policies。
2. Add a policy。
3. 名称：`imiles-admin-owners`。
4. Action：`Allow`。
5. Include selector：`Emails`。
6. 值：列出精确管理员邮箱。
7. Session duration：建议 4 至 8 小时。
8. 可选：启用 Independent MFA，或 Require IdP 提供的 MFA claim。
9. 保存为 reusable policy。

单人后台优先精确邮箱，不使用 `Emails ending in` 域名范围。Access 的 Include 是 OR、Require 是 AND，新增多个规则时需要重新检查组合语义。

### 7.4 创建 Self-hosted Application

1. Zero Trust → Access controls → Applications。
2. Create new application。
3. 选择 Self-hosted and private。
4. 应用名称从本地 `.env` 的 `CLOUDFLARE_ACCESS_APPLICATION_NAME` 获取，不写入公开文档。
5. 添加四个 public hostname/path：

   ```text
   imiles.me/admin
   imiles.me/admin/*
   imiles.me/api/v1/admin
   imiles.me/api/v1/admin/*
   ```

6. 绑定 `imiles-admin-owners` Allow policy。
7. 选择 OTP 或其他 IdP。
8. 只有一个 IdP 时可开启 Instant authentication。
9. Session Duration 与 Policy 保持明确且不过长。
10. Additional settings：
    - Cookie Path Attribute：关闭。
    - Binding Cookie：首版关闭；如后续开启，需要确认 Zaraz、Google tag gateway 和客户端兼容性。
    - CORS：无需开启，后台保持同源。
    - Service Auth 401 behavior：仅在后续添加机器访问策略时配置。
11. 创建应用。
12. 记录 Application Audience (AUD) tag。

应用 ID 和 issuer 从 Dashboard 获取，使用以下占位形式记录：

```text
Application ID: <ACCESS_APPLICATION_ID>
Issuer: https://<ACCESS_TEAM_NAME>.cloudflareaccess.com
```

Audience 已配置到 Worker Secret `ACCESS_AUD`，完整值不写入文档。当前编辑页还包含整个 `imiles` Worker Scope；正式保存时必须删除该 Scope，只保留四条 public hostname/path。

官方创建流程见 [Publish a self-hosted application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)。

### 7.5 配置 Worker 环境

生产 Worker 需要：

```text
ENVIRONMENT=production
ACCESS_ISSUER=https://<team-name>.cloudflareaccess.com
ACCESS_AUD=<应用 AUD tag>
ADMIN_EMAILS=<精确管理员邮箱，多个用逗号分隔>
SUBMISSION_HMAC_SECRET=<至少 32 字节随机值>
TURNSTILE_SITE_KEY=<Turnstile Widget Site Key>
TURNSTILE_SECRET_KEY=<Turnstile Widget Secret Key>
SUPABASE_S3_ACCESS_KEY_ID=<Supabase S3 Access Key ID>
SUPABASE_S3_SECRET_ACCESS_KEY=<Supabase S3 Secret Access Key>
ADMIN_SERVICE_TOKEN_IDS=<可选，多个 Service Token Client ID 用逗号分隔>
ADMIN_SERVICE_TOKEN_CAPABILITIES={"automation.access":["admin:read"]}
```

`ACCESS_ISSUER` 和 `ACCESS_AUD` 不是密码，但属于部署配置；`ADMIN_EMAILS` 包含身份信息。为保持项目当前“不在 wrangler.toml 声明业务变量”的约定，可以统一通过 Worker Secrets 或 Dashboard encrypted variables 配置：

```bash
pnpm exec wrangler secret put ENVIRONMENT
pnpm exec wrangler secret put ACCESS_ISSUER
pnpm exec wrangler secret put ACCESS_AUD
pnpm exec wrangler secret put ADMIN_EMAILS
pnpm exec wrangler secret put SUBMISSION_HMAC_SECRET
pnpm exec wrangler secret put TURNSTILE_SITE_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put SUPABASE_S3_ACCESS_KEY_ID
pnpm exec wrangler secret put SUPABASE_S3_SECRET_ACCESS_KEY
pnpm exec wrangler secret put ADMIN_SERVICE_TOKEN_IDS
pnpm exec wrangler secret put ADMIN_SERVICE_TOKEN_CAPABILITIES
```

当前前九项中除两个可选 Service Token 配置外均已部署。已有 Supabase S3 Secrets 在新增变量时保持不变。生产配置通过 Dashboard 分两批添加，避免逐项触发多次部署；后续自动化可使用被 Git 忽略的临时文件和 `wrangler secret bulk`。

如果后续建立 staging 环境，必须分别设置环境 Secret，不能复用生产 audience 或生产管理员配置。Wrangler 环境和环境 Secret 见 [Wrangler environments](https://developers.cloudflare.com/workers/wrangler/environments/)。

### 7.6 配置 Turnstile

Dashboard → Application security → Turnstile → Add widget manually：

```text
Widget name: <TURNSTILE_WIDGET_NAME>
Mode: Managed
Hostnames:
  imiles.me
Pre-clearance: Off
```

创建后把 Site Key 和 Secret Key 分别保存到：

- 本地被 Git 忽略的 `.env`。
- Worker Production Secret `TURNSTILE_SITE_KEY`。
- Worker Production Secret `TURNSTILE_SECRET_KEY`。

Site Key 会进入浏览器，本身不是服务端凭据；项目仍统一以 Worker Secret 管理，避免普通变量在部署时漂移。Secret Key 只能用于 Worker 的 Siteverify 请求，禁止进入客户端代码、公开 HTML、文档或 Git。

当前 Widget 已创建，生产 hostname `imiles.me` 已生效。若要使用真实 Widget 完成本地联调，应在 Hostname Management 中补充 `localhost`。更推荐本地使用 Cloudflare 官方测试 keys，使生产 Widget 只服务生产域名。

Widget 配置与代码校验必须一致：

```text
hostname: imiles.me
action: friend_link_submit
```

Turnstile token 是短期、单次使用的证明。服务端必须调用 Siteverify，客户端拿到 token 或组件显示成功都不能单独作为放行依据。

### 7.7 关闭旁路入口

生产只使用 `imiles.me` 自定义域名。Wrangler 应显式确认：

```toml
workers_dev = false
preview_urls = false
```

当前配置已有 custom domain route，Wrangler可能推断关闭 `workers.dev`，但显式配置更容易审计。Cloudflare说明，Dashboard 中单独关闭而 Wrangler 未同步可能在后续部署时被重新开启：[workers.dev](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)。

如果确实需要 Version/Preview URL，必须为它们单独配置 Access，不能把它们当作默认安全的预览环境。

### 7.8 验证日志和撤销

- Zero Trust → Insights → Logs → Access authentication logs：查看登录成功、失败、邮箱、应用和策略决策。
- Zero Trust → Team & Resources → Users：查看身份、Session，并执行撤销。
- 后台业务操作由应用自己的审计记录负责；Access 登录日志不会说明用户在后台批准或修改了什么。

Cloudflare 日志能力说明见 [Access authentication logs](https://developers.cloudflare.com/cloudflare-one/insights/logs/dashboard-logs/access-authentication-logs/)。

退出入口：

```text
https://imiles.me/cdn-cgi/access/logout
```

## 8. 环境模型

### 8.1 Local

用途：UI 开发、Service/Repository 测试、D1 本地集成测试。

- 不经过真实 Access。
- D1、KV 使用本地模拟资源。
- `.dev.vars` 只保存本地所需变量，不提交 Git。
- 后台 UI 使用 fixture data source。
- Access 验证使用本地生成的测试密钥和模拟 JWT，在 Node 测试中通过依赖注入验证。
- 不允许 HTTP 路由在 `ENVIRONMENT=development` 时自动跳过认证。

Wrangler建议使用 `.dev.vars` 管理本地 Secret，并明确不要提交仓库：[Environment variables](https://developers.cloudflare.com/workers/configuration/environment-variables/)。当前 `.gitignore` 已覆盖 `.env*`，实施前还应显式确认 `.dev.vars*` 被忽略。

### 8.2 Staging

用途：完整登录、Cookie、JWT、API、数据库迁移和浏览器联调。

建议：

```text
staging.imiles.me/admin/*
staging.imiles.me/api/v1/admin/*
```

- 独立 Worker environment/name。
- 独立 Access Application 和 AUD。
- 独立 D1 数据库、KV、限流和对象存储前缀或 Bucket。
- 精确管理员邮箱策略。
- 不连接生产数据。
- 手工验收后再部署生产。

Wrangler 的 non-inheritable bindings 必须在 staging 中重新声明，不能假设自动继承生产 D1/KV。

### 8.3 Production

- 只使用 `imiles.me` 自定义域名。
- Access精确保护后台路径。
- `workers.dev` 和 Preview URL 关闭，或另行保护。
- 生产 D1、KV、对象存储和 Secrets。
- 管理 API 全部 no-store。
- 日志不记录 JWT、Cookie、邮箱正文或敏感业务载荷。

## 9. 本地开发工作流

本地开发分为三个独立回路，不为“本地一键登录”牺牲生产安全边界。

### 9.1 UI 回路

定义客户端接口：

```ts
interface AdminDataSource {
  getSession(signal?: AbortSignal): Promise<AdminSession>;
  // 未来业务模块在各自接口中扩展，不在核心框架堆积万能方法。
}
```

实现：

```text
HttpAdminDataSource      生产和 staging，通过 same-origin fetch
FixtureAdminDataSource   仅 import.meta.env.DEV，用固定数据和可控错误状态
```

fixture 需要覆盖：

- 首次加载。
- 空状态。
- 正常列表和详情外壳。
- 401/403。
- 409 冲突。
- 500 和网络失败。
- 慢请求及取消。

生产构建中的 `import.meta.env.DEV` 为 false，fixture 模块必须通过明确的开发分支和动态 import 隔离，构建后检查其未进入生产浏览器包。

### 9.2 服务端回路

- `verifyAccessToken()` 接收可注入的 `JWTVerifyGetKey`，测试使用本地 JWK。
- Route 测试传入签名测试 JWT。
- Service 直接注入 Repository fake 或本地 D1 Repository。
- Repository 使用 `persist:false`、`remoteBindings:false` 的本地 D1。
- 测试不访问真实 Access certs、生产 D1 或生产 Storage。

### 9.3 完整集成回路

真实 Access 登录只在 staging 完成：

1. 部署 staging。
2. 访问 staging 后台路径。
3. 完成 OTP/IdP 登录。
4. 验证 Session API。
5. 验证管理 API、私有媒体和写请求 Origin。
6. 撤销 Session，确认 API 立即失效。

不把 Service Token 放入浏览器来模拟用户登录。Service Token只用于无人值守客户端或 API 调试工具。

## 10. 项目渲染与 Cloudflare 构建设计

### 10.1 后台页面

后台 `.astro` 页面必须：

```astro
---
export const prerender = true;
import AdminLayout from '@/layouts/AdminLayout.astro';
import AdminApp from '@/components/admin/AdminApp';
---

<AdminLayout title="管理后台">
  <AdminApp client:only="react" />
</AdminLayout>
```

Astro 在 `output: 'server'` 下支持单页 `prerender = true`，因此后台 HTML 作为静态资产生成，不在请求时由 Worker SSR。`client:only` 跳过 React 服务端渲染，只生成浏览器入口。

### 10.2 独立 AdminLayout

不得复用公开站点 `BaseLayout.astro`。AdminLayout 仅包含：

- `global.css`。
- 字体、favicon、viewport。
- 极简主题初始化脚本。
- `robots=noindex,nofollow,noarchive`。
- `color-scheme`。
- 后台 React 挂载点。

不得包含：

- 公开站点 Header/Footer。
- SocialDock。
- 公开 SEO 组件。
- Three.js 或 Motion 背景。
- Newsletter。
- 公开站点 Service Worker 注册逻辑。
- 任何管理员身份或管理数据。

### 10.3 客户端 bundle 规则

- 客户端不得导入 `src/server/*`。
- 共享类型放在 `src/shared`，保持纯 TypeScript，无运行时服务端依赖。
- shadcn 组件按文件直接导入，不使用聚合大量组件的 barrel。
- 首版不引入 React Router、TanStack Table、React Query、Zustand、图表库或 Motion。
- 后台模块使用原生链接进行页面级导航。
- 较重的详情 Sheet 或编辑器可使用 `React.lazy()`。
- 业务图片按需加载。
- 不在静态 HTML props 中序列化管理数据。

### 10.4 构建验收

每次基础设施或后台依赖变化后手工验证：

```bash
pnpm exec biome check <changed-files>
pnpm check:server
pnpm test:server
pnpm build
```

随后检查：

- 后台页面在 `dist/admin/` 形成静态 HTML。
- 后台 React 代码位于 `dist/_astro/` 浏览器资产。
- 没有出现大型 `dist/_worker.js/chunks/Admin*` SSR chunk。
- 浏览器 bundle 不包含 `jose`、Drizzle、AWS SDK 或服务端错误实现。
- Worker 总大小没有因后台 UI 明显增长。

这套渲染隔离可以减少 Worker bundle，但 Vite仍然需要编译客户端代码，不能解决所有 `astro check` 内存问题。类型检查 OOM 需要单独诊断。

## 11. Service Worker 与缓存边界

当前根作用域 `public/sw.js` 会缓存所有同源图片，并且主动调用 Cache API；这可能包含受保护的后台图片，即使源响应设置 `Cache-Control: no-store`。

后台上线前必须让 Service Worker首先排除：

```text
/admin
/admin/*
/api/v1/admin
/api/v1/admin/*
```

这些请求必须直接交给浏览器网络栈和 Access，不能 `respondWith()`、不能写入 Cache API。

`/_astro/*` 哈希静态资源可以继续缓存。浏览器能下载后台 JS 不构成授权；JS 中不能包含密钥或管理数据。

管理 API、Session API 和私有媒体响应统一：

```text
Cache-Control: no-store
X-Content-Type-Options: nosniff
```

后台静态 HTML 本身不包含身份和数据。即使浏览器在登出后短暂保留页面外壳，所有数据请求仍须通过 Access 和 Worker 鉴权。

## 12. 服务端模块架构

目标结构：

```text
src/server/
  admin/
    session/
      routes.ts
      service.ts
      types.ts
    audit/
      repository.ts       # 出现多管理员或高价值操作时落地
      service.ts
      types.ts

  security/
    access/
      verifier.ts
      actor.ts
      authorization.ts
      config.ts
      index.ts
    origin.ts

  rest/
  db/
  kv/
  media/

src/pages/api/v1/admin/
  session.ts
  ...业务模块入口
```

### 12.1 Access Verifier

只负责密码学和 claim 验证：

```ts
interface AccessTokenVerifier {
  verify(request: Request, env: CloudflareEnv): Promise<VerifiedAccessClaims>;
}
```

必须验证：

- Header 存在且长度有界。
- 算法仅允许 RS256。
- issuer 精确匹配。
- audience 包含当前应用 AUD。
- `exp`、`iat` 和 `sub` 等必要 claim。
- JWK 请求使用 HTTPS、固定 issuer 派生地址及合理超时。

Verifier 不查询 D1、不判断业务权限、不返回 HTTP Response。

### 12.2 Actor Mapper

把 Cloudflare claim 转换为应用内部身份：

```ts
type AdminActor =
  | { kind: 'user'; id: string; email: string }
  | { kind: 'service'; id: string; clientId: string };
```

业务层只接收 `AdminActor` 或稳定的 `actor.id`，不直接读取 JWT payload。

用户 Actor ID 首版可使用规范化邮箱：

```text
user:<lowercase-email>
```

Service Token：

```text
service:<client-id>
```

这样日志和数据字段不会混淆用户与机器身份。

### 12.3 Authorization

首版授权规则：

```text
Access Allow policy
AND 有效应用 JWT
AND ADMIN_EMAILS 精确 allowlist
```

双层邮箱限制是有意的纵深防御，但带来配置同步成本。修改管理员时必须同时更新 Access Policy 和 Worker `ADMIN_EMAILS`。

授权接口预留能力模型，不在首版落地数据库 RBAC：

```ts
type AdminCapability =
  | 'admin:read'
  | 'admin:write'
  | 'admin:maintenance';

interface AdminAuthorizer {
  require(actor: AdminActor, capability: AdminCapability): void;
}
```

首版用户管理员拥有三项能力；Service Token 默认只授予明确配置的最小能力。业务 Route 不直接比较邮箱字符串。

### 12.4 Origin / CSRF

浏览器写请求必须：

- same-origin。
- `Origin` 精确等于配置的 `SITE_URL` origin。
- JSON Content-Type。
- 继续接受 Astro 默认来源检查。

Service Token 请求没有浏览器 Cookie 和 Origin 时，只有经过签名验证、Client ID 白名单和能力检查后才可进入对应机器接口。

### 12.5 Admin Session Service

新增基础接口：

```text
GET /api/v1/admin/session
```

响应只提供后台框架所需信息：

```json
{
  "success": true,
  "data": {
    "actor": {
      "kind": "user",
      "id": "user:owner@example.com",
      "email": "owner@example.com"
    },
    "capabilities": ["admin:read", "admin:write", "admin:maintenance"]
  }
}
```

不返回原始 JWT、过期时间、issuer、audience、Access Cookie 或所有 claim。

### 12.6 业务接入规范

每个后台业务继续使用：

```text
API Route → Authentication → Authorization → Input Validation
          → Service → Repository → D1 / Storage
```

- Route：HTTP、Zod、状态码、Actor 和能力检查。
- Service：状态机、幂等、事务边界、补偿和审计调用。
- Repository：固定查询、参数绑定、条件写入和数据库错误映射。
- Schema：关键数据不变量使用 UNIQUE、CHECK、FOREIGN KEY。
- Audit：记录实际成功的业务变化，不记录仅点击按钮或失败验证。

Service 不接收 Astro `APIContext`、Request、Response 或 JWT payload。Repository 不做身份验证。

## 13. 错误、会话过期与客户端恢复

应用 API 正常返回统一 JSON 错误。Access Session 失效时，Cloudflare可能将 fetch 重定向到 HTML 登录页面，因此客户端 API 层必须同时检查：

- `response.redirected`。
- `Content-Type` 是否为 JSON。
- HTTP 401 / 403。

检测到 Access 登录失效时：

1. 停止当前请求和 mutation。
2. 清空内存中的管理数据。
3. 显示“登录状态已失效，正在重新验证”。
4. 导航到当前 `/admin/...` 页面。
5. 由正常页面导航触发 Access 登录。

不要导航到 API URL，否则重新登录后可能停留在 JSON 接口。

错误 UI 显示用户可理解的消息及 `requestId`，不显示堆栈、SQL、JWT 或上游存储错误正文。

## 14. 业务审计基础

Access Authentication Logs 记录谁登录和策略结果，但不记录具体业务动作。后台出现以下任一条件时，应落地 `admin_audit_logs`：

- 第二个管理员加入。
- 后台可以修改公开内容。
- 操作不可轻易恢复。
- 需要追查数据变化历史。

建议结构：

```text
id                 随机日志 ID
actor_id           user:* / service:*
capability         使用的能力
action             稳定动作名
resource_type      资源类型
resource_id        资源 ID
request_id         与 HTTP 日志关联
before_json        可选、脱敏、有大小限制
after_json         可选、脱敏、有大小限制
created_at         毫秒时间戳
```

审计日志只追加，不提供普通编辑和删除接口。敏感字段、JWT、Cookie、Service Token、密码和完整邮件正文不得写入。

首版框架可以先定义接口和 no-op 实现，只有在第一个业务模块明确需要时创建表和迁移，避免为占位创建无消费者数据结构。

## 15. 后台 UI 框架

### 15.1 页面框架

首版后台外壳包含：

```text
AdminLayout.astro
  └─ AdminApp.tsx
       ├─ AdminShell
       │    ├─ DesktopSidebar
       │    ├─ MobileNavigation
       │    ├─ AdminHeader
       │    └─ MainContent
       ├─ SessionBoundary
       ├─ ErrorBoundary
       └─ Toaster
```

UI 只搭建稳定框架，不接具体业务：

- 品牌和“管理后台”标题。
- 折叠侧栏。
- 移动端 Sheet 导航。
- 面包屑区域。
- 当前管理员菜单。
- 主题切换。
- Session 加载、无权限、失效和通用错误页面。
- 空的 Dashboard 首页。
- 404 / 模块不可用状态。

### 15.2 shadcn/ui 原语

现有 `Button`、`DropdownMenu` 继续复用，按需增加：

```text
avatar
badge
breadcrumb
card
separator
sheet
skeleton
sonner
tooltip
```

这些组件保持纯 UI，不导入 API、Actor、路由或业务状态。

暂不增加：

- Data table。
- Chart。
- Command palette。
- 富文本编辑器。
- 复杂表单框架。
- 动画和 Three.js。

### 15.3 视觉规范

- 使用现有 Tailwind CSS variables 和深浅主题。
- 后台强调清晰、密度和可扫描性，不沿用公开首页的大型动效。
- 桌面侧栏约 240px，可收起为图标栏。
- Header 固定显示面包屑、状态和用户菜单。
- 主内容限制合理最大宽度，但列表页可使用全宽。
- 移动端使用卡片或 Sheet，不压缩桌面表格。
- 所有交互满足键盘焦点、Esc 关闭、focus trap 和可访问名称。

### 15.4 路由策略

首版无需 React Router。模块页面使用 Astro 静态路由：

```text
/admin
/admin/<module>
```

每个页面加载同一 `AdminApp` 外壳，并用字符串 module key 选择客户端模块。页面级导航使用普通 `<a>`，减少路由依赖和客户端状态复杂度。

模块增多、出现嵌套编辑器和未保存状态拦截后，再评估 React Router；不提前引入。

## 16. 推荐项目结构

```text
src/
  pages/
    admin/
      index.astro
    api/v1/admin/
      session.ts

  layouts/
    AdminLayout.astro

  components/
    admin/
      AdminApp.tsx
      AdminShell.tsx
      AdminHeader.tsx
      AdminSidebar.tsx
      AdminMobileNavigation.tsx
      AdminErrorBoundary.tsx
      SessionBoundary.tsx
      nav.ts
      types.ts
      data-source/
        http.ts
        fixture.ts
        types.ts
    ui/
      ...shadcn primitives

  lib/
    admin/
      api-client.ts
      api-error.ts

  shared/
    admin/
      session-contract.ts
      capabilities.ts

  server/
    admin/
      session/
        routes.ts
        service.ts
    security/
      access/
        verifier.ts
        actor.ts
        authorization.ts
        config.ts
        index.ts
      origin.ts
```

避免创建一个不断膨胀的 `adminService`、`adminRepository` 或 `admin.ts`。后台是安全和 UI 壳层，每个业务仍保留自己的 Service 和 Repository。

## 17. 分阶段实施

### Phase 0：Cloudflare 配置验证

- 建立 OTP/IdP。
- 建立精确邮箱 policy。
- 建立 Self-hosted application 和四条路径。
- 配置 Session、Cookie Path 和 AUD。
- 配置 Worker variables/secrets。
- 关闭或保护旁路 URL。
- 用临时受保护路径验证登录、登出和 Session 撤销。

完成条件：未经允许的邮箱无法访问，允许邮箱能登录，Worker 能收到并验证正确 JWT。

### Phase 1：服务端身份基础

- 抽取 Access verifier、Actor 和 Authorizer。
- 保留用户与 Service Token 两类 Actor。
- 新增 Session Service 和 API。
- 测试 issuer、audience、过期、伪造签名、邮箱白名单和 Service Token。
- 保留同源写保护。

完成条件：所有管理 API 可以复用统一身份入口，业务模块不解析 JWT。

### Phase 2：渲染与缓存边界

- 新建 AdminLayout。
- 新建静态 `/admin` 页面。
- React 根组件使用 `client:only`。
- Service Worker 排除后台和管理 API。
- 配置 noindex。
- 验证构建产物和 Worker bundle。

完成条件：后台 UI 只进入浏览器资产，管理数据不出现在 HTML，私有响应不被 Service Worker 缓存。

### Phase 3：后台 UI 框架

- AdminShell、Sidebar、Header 和移动导航。
- SessionBoundary。
- 用户菜单、主题、登出。
- loading、forbidden、expired、error 和空 Dashboard。
- Http/Fixture data source。

完成条件：不接具体业务也能稳定完成登录、显示身份、页面导航、错误恢复和退出。

### Phase 4：staging 全链路

- 独立 staging Worker 和绑定。
- 独立 Access app/AUD。
- 完整浏览器登录和 API 联调。
- Session 过期和撤销测试。
- workers.dev / preview URL 检查。
- 构建、日志和错误关联检查。

完成条件：真实环境可反复登录、访问、撤销和恢复，不使用生产数据。

### Phase 5：业务模块接入

只有完成以上基础后，友链等业务模块才接入后台壳。每个模块单独设计权限、Route、Service、Repository、状态机、审计和 UI，不修改基础认证协议。

## 18. 上线验收清单

### Access

- [ ] 只允许精确管理员邮箱。
- [ ] 没有 Everyone、所有有效邮箱或不必要的 Bypass。
- [ ] `/admin`、`/admin/*`、管理 API 根路径和通配路径均受保护。
- [ ] Cookie Path Attribute 已按同域双路径场景关闭。
- [ ] Session 时长符合预期。
- [ ] 登录、登出、拒绝和撤销均已验证。
- [ ] AUD 与 Worker 配置一致。

### Worker

- [ ] 每个管理 API 都验证 JWT 签名、issuer、audience 和过期。
- [ ] 应用管理员 allowlist 生效。
- [ ] 浏览器写请求执行同源 Origin 检查。
- [ ] API 和私有媒体统一 no-store。
- [ ] 5xx 不泄漏内部异常。
- [ ] workers.dev 和 Preview URL 已关闭或保护。

### 构建

- [ ] Admin 页面已预渲染。
- [ ] React 根组件为 `client:only="react"`。
- [ ] AdminLayout 不依赖 BaseLayout 和公开站点重组件。
- [ ] 客户端 bundle 不包含服务端 SDK。
- [ ] Worker bundle 未因后台 UI 明显增长。

### 浏览器

- [ ] Service Worker 不处理后台页面、API 和私有图片。
- [ ] 浏览器存储中没有 JWT、Service Token 或管理数据。
- [ ] Session 失效能回到正常登录流程。
- [ ] 管理页面为 noindex。
- [ ] 移动端和键盘操作可用。

### 本地与 staging

- [ ] 本地没有认证绕过开关。
- [ ] UI fixture 能覆盖主要状态。
- [ ] Access JWT 测试使用本地密钥，不访问远程 certs。
- [ ] staging 不复用生产 D1、KV、Storage 或 AUD。
- [ ] 完整联调只在受 Access 保护的 staging 进行。

## 19. 风险与取舍

| 风险 | 影响 | 处理 |
| --- | --- | --- |
| Cloudflare/IdP 不可用 | 管理员暂时无法登录 | 公开站点不受影响；可配置备用 IdP |
| Access 控制台配置漂移 | 页面或 API 错误暴露/阻断 | 文档清单、双层 JWT 验证、后续 IaC |
| 本地没有真实 Access | 无法本地完成完整浏览器登录 | fixture + JWT 测试 + staging 三段式 |
| 静态后台壳被直接获取 | 暴露 UI 结构 | 壳不含密钥和数据；API 是最终边界 |
| Access Session 过期返回 HTML | 客户端 JSON 解析失败 | 统一 API client 检查 redirect/content-type |
| Service Worker 缓存私有图片 | 登出后本地仍可读取 | 明确排除后台和管理 API |
| 双层邮箱 allowlist 不同步 | 合法用户被拒绝 | 管理员变更清单同时更新两处 |
| Worker bundle 持续扩大 | 构建或部署风险 | prerender + client:only + 构建产物检查 |
| Access 日志被误当审计 | 无法还原业务修改 | 高价值操作使用应用审计日志 |
| 未来多角色需求 | `ADMIN_EMAILS` 无法表达权限 | 保留 Capability 接口，按真实需求引入 RBAC |

## 20. 最终架构原则

1. Access 认证身份，应用授权动作。
2. 静态后台壳不等于公开后台数据。
3. API 是最终安全边界，UI 不承担权限判断。
4. 测试身份通过依赖注入，不通过环境绕过。
5. 后台 UI 进入浏览器 bundle，不进入 Worker SSR 页面图。
6. 管理数据默认 no-store，也不能被 Service Worker 主动缓存。
7. 安全基础设施通用化，业务 Service 保持独立。
8. 先建立 staging 全链路，再接业务模块。
9. 配置、代码、部署和验收必须形成同一套可重复流程。
10. 只在真实需求出现时增加 RBAC、审计表、路由框架和复杂状态库。
