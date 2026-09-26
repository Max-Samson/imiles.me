# Cloudflare 生产部署配置

本文对应当前 `imiles.me` 实现，覆盖 Worker、D1、KV、Rate Limiting、Cloudflare Access、Turnstile 和 Supabase S3。所有命令均在仓库根目录执行。本文只说明操作，不代表远程资源已经创建或迁移。

## 1. 当前部署模型

```text
imiles.me
  └─ Cloudflare Custom Domain
       └─ Worker: imiles
            ├─ Static Assets: dist/
            ├─ D1 binding: DB → BLOG-DB
            ├─ KV binding: KV → BOLG-KV
            ├─ KV binding: SESSION → imiles-session
            ├─ Rate Limit binding: FRIEND_LINK_RATE_LIMITER
            └─ Supabase S3 私有 Bucket

/admin*、/api/v1/admin*
  └─ Cloudflare Access
       └─ Worker 再验证 Cf-Access-Jwt-Assertion 和业务能力
```

`wrangler.toml` 已关闭 `workers.dev` 和 Preview URL，并把 `imiles.me` 配置为 Custom Domain。公开站点不经过 Access 登录，只有后台页面和管理 API 受保护。

## 2. 变量分类策略

所有生产配置按敏感程度分为三类，采用不同的配置渠道：

| 类别 | 示例变量 | 配置渠道 | 是否进入 Git |
| --- | --- | --- | --- |
| **绑定资源（Binding）** | `DB`、`KV`、`SESSION`、`FRIEND_LINK_RATE_LIMITER` | `wrangler.toml` `[[bindings]]` | ✅ 是 |
| **非敏感元数据（Vars）** | `CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_D1_DATABASE_ID`、`SUPABASE_PROJECT_REF` 等资源标识符 | `wrangler.toml` `[vars]` | ✅ 是 |
| **敏感凭据（Secrets）** | `ACCESS_ISSUER`、`ACCESS_AUD`、`ADMIN_EMAILS`、`SUPABASE_S3_ACCESS_KEY_ID` 等 | `wrangler secret put` / `wrangler secret bulk` | ❌ 否，仅存在于 Cloudflare 加密存储 |

**原则：**
- 资源 ID（Account ID、Database ID、Namespace ID、Project Ref）不是密钥，泄露不会直接导致数据被篡改，可以进入 `[vars]`。
- 凭据（密钥、Token、Secret、密码）一律通过 `wrangler secret put` 写入；`pnpm deploy` 执行时不传 `--keep-vars`，Dashboard 中手动添加的 plaintext vars 会被清除，务必使用 Secrets 而非 Dashboard vars。

## 3. 上线前必须补齐 SESSION KV

Astro Cloudflare adapter 默认注入 `cloudflare-kv-binding` Session 驱动，并读取名为 `SESSION` 的 binding。当前代码没有使用 Astro Session，但生产 Worker 仍应提供该 binding，避免运行时出现 `Invalid binding SESSION`。

推荐创建独立 namespace：

```bash
pnpm exec wrangler kv namespace create imiles-session \
  --binding SESSION \
  --update-config
```

命令会创建 namespace，并将类似以下内容写入 `wrangler.toml`：

```toml
[[kv_namespaces]]
binding = "SESSION"
id = "<Cloudflare 返回的 namespace id>"
```

不要手写或猜测 ID。创建后运行 `pnpm cf:types`，确认生成类型包含 `SESSION`。

## 4. 核对现有 Worker 资源

当前 `wrangler.toml` 预期以下资源都属于部署账号：

| Binding | 远程资源 | 当前用途 |
| --- | --- | --- |
| `DB` | D1 `BLOG-DB`，ID `24e0cea3-...` | 友链申请与审核记录 |
| `KV` | KV `BOLG-KV`，ID `1bea21d8-...` | 通用缓存 |
| `SESSION` | KV `imiles-session`，ID `9ecf2007-...` | Astro adapter Session 驱动 |
| `FRIEND_LINK_RATE_LIMITER` | namespace `1001` | 友链申请近似限流，5 次/60 秒 |
| `ASSETS` | `dist/` | Astro 静态资源 |

先确认当前 Wrangler 登录账号：

```bash
pnpm exec wrangler whoami
```

如果 D1 或 KV 不属于该账号，不要直接部署。先将 `database_id`、KV `id` 和 `[vars]` 中对应的元数据值替换为正确生产资源。Rate Limiting binding 只由 Wrangler 配置，当前不会显示在 Dashboard 的普通 binding 列表中；`namespace_id` 必须是账号内自行分配的正整数字符串，不能与其他无关限流器复用。

## 5. 创建 Turnstile Widget

Cloudflare Dashboard → **Turnstile** → **Add widget**：

1. Name：`imiles-friend-link-application`（与 `wrangler.toml` `[vars]` 中的 `CLOUDFLARE_TURNSTILE_WIDGET_NAME` 保持一致）。
2. Hostname：`imiles.me`。
3. Mode：`Managed`。
4. Pre-clearance：关闭，当前业务不依赖 clearance cookie。
5. 创建后保存 Site Key 和 Secret Key。

客户端使用固定 action：

```text
friend_link_submit
```

服务端会同时检查 `success`、`hostname=imiles.me` 和上述 action。仅创建 Widget 而不配置 Worker Secret，申请仍会失败关闭。

官方文档：[创建 Turnstile Widget](https://developers.cloudflare.com/turnstile/get-started/widget-management/dashboard/)、[Hostname 管理](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/)、[服务端校验](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)。

## 6. 创建 Cloudflare Access 后台应用

### 6.1 配置登录方式

Cloudflare Zero Trust → **Integrations → Identity providers**。

个人站点首版可以启用 One-time PIN；也可以使用 Google 或 GitHub IdP。只有登录方式还不够，Allow Policy 必须继续限制精确管理员邮箱。

### 6.2 创建管理员策略

Zero Trust → **Access controls → Policies**：

1. Policy name：`imiles-admin-owners`。
2. Action：`Allow`。
3. Include：`Emails`。
4. 填写精确管理员邮箱。
5. Session duration：建议 4–8 小时。

不要使用仅包含 `Login Methods = One-time PIN` 的 Allow 策略，也不要使用宽泛邮箱域名规则。

### 6.3 创建 Self-hosted Application

Zero Trust → **Access controls → Applications → Create new application → Self-hosted and private**。

应用名称：`imiles-admin`。在同一个应用中添加四个 public hostname/path：

```text
imiles.me/admin
imiles.me/admin/*
imiles.me/api/v1/admin
imiles.me/api/v1/admin/*
```

根路径和通配路径都要添加，`path/*` 不覆盖父路径本身。绑定 `imiles-admin-owners` Policy，并保持：

- Cookie Path Attribute：关闭，使页面和 API 共用 Access Cookie。
- CORS：关闭，后台只使用 same-origin 请求。
- Binding Cookie：首版关闭。
- 不创建 Bypass Policy。
- 记录 Application Audience (AUD) tag，将其配置为 Secret `ACCESS_AUD`。
- 将 Application ID 更新到 `wrangler.toml` `[vars]` 的 `CLOUDFLARE_ACCESS_APPLICATION_ID`。

Worker 会继续验证 `Cf-Access-Jwt-Assertion` 的签名、issuer、audience、过期时间和管理员白名单。Access 层放行并不等于跳过 Worker 授权。

官方文档：[创建 Self-hosted Application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)、[路径匹配](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)、[JWT 验证字段](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)。

## 7. 配置 Worker Secrets（敏感凭据）

以下变量包含凭据或私有身份标识，**必须通过 `wrangler secret put` 写入，不能进入 `wrangler.toml` 或 git**。

### 7.1 必需 Secrets

| Secret | 值来源 |
| --- | --- |
| `ENVIRONMENT` | 固定值 `production` |
| `ACCESS_ISSUER` | `https://<team-name>.cloudflareaccess.com`，不能有尾部 `/` |
| `ACCESS_AUD` | Access Application 的 AUD tag |
| `ADMIN_EMAILS` | 与 Access Allow Policy 一致的管理员邮箱，多个用逗号分隔 |
| `TURNSTILE_SITE_KEY` | Widget 的公开 Site Key（虽非真正密钥，仍通过 Secret 管理以避免暴露） |
| `TURNSTILE_SECRET_KEY` | Widget 的 Secret Key |
| `SUBMISSION_HMAC_SECRET` | 至少 32 字符随机密钥，生成见下方 |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase Storage S3 Access Key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | 对应的 S3 Secret Access Key |

生成 HMAC Secret：

```bash
openssl rand -base64 32
```

推荐使用 `wrangler secret bulk` 一次性写入，避免每次 `secret put` 触发独立的 Worker 部署版本。准备临时文件（用后立即删除）：

```bash
# 1. 创建临时文件（此文件已被 .gitignore 排除）
cat > .secrets.json << 'EOF'
{
  "ENVIRONMENT": "production",
  "ACCESS_ISSUER": "https://364475182.cloudflareaccess.com",
  "ACCESS_AUD": "<your-aud-tag>",
  "ADMIN_EMAILS": "maxshuai355@gmail.com,1809491420@qq.com",
  "TURNSTILE_SITE_KEY": "<your-turnstile-site-key>",
  "TURNSTILE_SECRET_KEY": "<your-turnstile-secret-key>",
  "SUBMISSION_HMAC_SECRET": "<openssl-rand-output>",
  "SUPABASE_S3_ACCESS_KEY_ID": "<your-s3-access-key-id>",
  "SUPABASE_S3_SECRET_ACCESS_KEY": "<your-s3-secret-access-key>"
}
EOF

# 2. 一次性写入所有 Secrets（仅一个 Worker 版本）
pnpm exec wrangler secret bulk .secrets.json

# 3. 立即删除临时文件
rm .secrets.json
```

或逐项交互式输入（每次产生一个新 Worker 版本）：

```bash
pnpm exec wrangler secret put ENVIRONMENT
pnpm exec wrangler secret put ACCESS_ISSUER
pnpm exec wrangler secret put ACCESS_AUD
pnpm exec wrangler secret put ADMIN_EMAILS
pnpm exec wrangler secret put TURNSTILE_SITE_KEY
pnpm exec wrangler secret put TURNSTILE_SECRET_KEY
pnpm exec wrangler secret put SUBMISSION_HMAC_SECRET
pnpm exec wrangler secret put SUPABASE_S3_ACCESS_KEY_ID
pnpm exec wrangler secret put SUPABASE_S3_SECRET_ACCESS_KEY
```

不要把真实值写进命令参数、Git 或文档。

### 7.2 `wrangler.toml [vars]` 已覆盖，无需重复配置

以下变量已在 `wrangler.toml` 的 `[vars]` 节配置，部署时 Wrangler 自动传入 Worker，无需额外操作：

| Var | 当前值 | 说明 |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | `4e43dbdc3855c41ab85cb84837885775` | 账号 ID，用于构造 Dashboard 跳转链接 |
| `CLOUDFLARE_WORKER_NAME` | `imiles` | Worker 名称 |
| `CLOUDFLARE_ACCESS_TEAM_NAME` | `364475182` | Zero Trust 团队名，用于构造 Access 登录页链接 |
| `CLOUDFLARE_ACCESS_APPLICATION_ID` | `c5775dce-...` | Access 应用 ID，用于构造 Access 应用控制台链接 |
| `CLOUDFLARE_D1_DATABASE_NAME` | `BLOG-DB` | D1 名称 |
| `CLOUDFLARE_D1_DATABASE_ID` | `24e0cea3-...` | D1 数据库 ID，用于构造 D1 控制台链接 |
| `CLOUDFLARE_KV_NAMESPACE_NAME` | `BOLG-KV` | 业务 KV 名称 |
| `CLOUDFLARE_KV_NAMESPACE_ID` | `1bea21d8-...` | 业务 KV ID |
| `CLOUDFLARE_SESSION_KV_NAMESPACE_NAME` | `imiles-session` | 会话 KV 名称 |
| `CLOUDFLARE_SESSION_KV_NAMESPACE_ID` | `9ecf2007-...` | 会话 KV ID |
| `CLOUDFLARE_TURNSTILE_WIDGET_NAME` | `imiles-friend-link-application` | Turnstile 挂件名称 |
| `SUPABASE_PROJECT_REF` | `ghdcvipfbkxjbglmvrfa` | Supabase 项目 Ref |
| `SUPABASE_S3_REGION` | `ap-southeast-1` | S3 区域 |
| `SUPABASE_STORAGE_BUCKET` | `blog-bucket` | 存储桶名称 |
| `SUPABASE_S3_ENDPOINT` | `https://ghdcvipfbkxjbglmvrfa.storage.supabase.co/...` | S3 端点 URL |

> **注意**：上表中的资源 ID 均已在 `wrangler.toml` 中明文存在（`d1_databases.database_id`、`kv_namespaces.id`），进入 `[vars]` 只是让服务端代码可以通过统一的 `env.CLOUDFLARE_*` 接口读取，不引入额外的安全风险。

### 7.3 验证 Secrets 已写入

检查 Secret 名称（不会显示内容）：

```bash
pnpm exec wrangler secret list
```

官方文档：[Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Wrangler secret bulk](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。

## 8. 核对 Supabase Storage

当前服务端使用：

```text
Endpoint: https://ghdcvipfbkxjbglmvrfa.storage.supabase.co/storage/v1/s3
Region:   ap-southeast-1
Bucket:   blog-bucket
对象前缀:  friend-links/screenshots/
```

上线前确认：

1. `blog-bucket` 存在并保持 Private。
2. S3 Access Key 仍有效，并与 Secret Access Key 配对。
3. Worker 使用的 S3 密钥有上传、下载、列举和删除权限。
4. 浏览器不能匿名读取 Bucket 对象。
5. 若此前密钥曾出现在聊天、日志或截图中，先轮换再配置生产 Secret。

Worker 会检查图片真实格式、尺寸、文件大小与 SHA-256；Bucket 的 MIME/大小限制只是第二层保护。

详细说明见 [Supabase Storage 配置](./supabase-storage-setup.md)。

## 9. 应用生产 D1 迁移

先检查待应用迁移：

```bash
pnpm exec wrangler d1 migrations list BLOG-DB --remote
```

确认目标确实是生产 D1 后执行：

```bash
pnpm exec wrangler d1 migrations apply BLOG-DB --remote
```

Wrangler 会记录已应用迁移；官方说明 apply 前会确认并创建备份，单个失败迁移会回滚。不要用 `d1 execute` 手工复制迁移 SQL，也不要只上传 Drizzle meta 文件。

官方文档：[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)、[Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)。

## 10. 构建和部署

先执行本地门禁：

```bash
pnpm lint
pnpm check:server
pnpm test:server
pnpm db:check
pnpm build
pnpm exec wrangler deploy --dry-run
```

确认构建产物、bindings 和路由无错误后部署：

```bash
pnpm deploy
```

部署会使用当前配置：

```text
Worker name: imiles
Custom Domain: imiles.me
workers.dev: disabled
Preview URLs: disabled
```

Custom Domain 会由 Wrangler/Cloudflare 管理 DNS 和证书；不要再为同一 hostname 配置冲突的 Worker route。官方说明见 [Workers Custom Domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)。

## 11. 第三方审核工具（可选）

站内后台登录不需要 Service Token。只有外部审核工具或无人值守客户端接入管理 API 时才配置：

1. Zero Trust → **Access controls → Service credentials → Service Tokens**。
2. 创建 `imiles-review-tool`，立即保存 Client ID 和 Client Secret。
3. 在 `imiles-admin` Access Application 增加 Action 为 `Service Auth` 的 Policy，Include 该 Service Token。
4. Worker 增加（通过 `wrangler secret put` 或 `secret bulk`）：

   ```text
   ADMIN_SERVICE_TOKEN_IDS=<Client ID>
   ADMIN_SERVICE_TOKEN_CAPABILITIES={"<Client ID>":["admin:read","admin:write"]}
   ```

5. 外部工具发送：

   ```text
   CF-Access-Client-Id: <Client ID>
   CF-Access-Client-Secret: <Client Secret>
   ```

默认不要授予 `admin:maintenance`。Client Secret 不能进入浏览器。Service Token 官方说明见 [Service Tokens](https://developers.cloudflare.com/cloudflare-one/access-controls/service-credentials/service-tokens/) 和 [Service Auth Policy](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/common-policies/)。

## 12. 上线验收

按顺序检查：

1. `https://imiles.me/` 和 `/friends` 可匿名访问，不跳转 Access。
2. 未登录访问 `/admin`、`/admin/`、`/api/v1/admin/session` 均进入 Access 或返回身份错误。
3. 管理员登录后 `/api/v1/admin/session` 返回 user Actor 和三项 capability，不返回 JWT 或配置。
4. 管理员登录后 `/api/v1/admin/infra` 返回完整基础设施元数据（账号 ID、资源 ID、项目 Ref 等）。
5. 非 `ADMIN_EMAILS` 用户即使通过 IdP，也无法进入 Worker 管理接口。
6. `/friends` 能加载 Turnstile；提交后返回 201，重复幂等请求返回 200。
7. D1 中产生 `pending` 申请；待审截图只有管理接口可读。
8. 审核通过后公开列表和公开截图可见；隐藏后公开截图返回 404。
9. 连续提交触发限流时返回 429 和 `Retry-After: 60`。
10. `https://<worker>.workers.dev` 与 Preview URL 无法作为旁路入口。
11. Zero Trust Access logs 和 Workers Logs 中没有 JWT、Cookie、S3 密钥或完整请求正文。

退出地址：

```text
https://imiles.me/cdn-cgi/access/logout
```

出现问题时优先检查：Access 应用路径、AUD、issuer 是否有尾部斜杠、管理员邮箱两处是否一致、`SESSION` binding、Turnstile hostname/action、D1 迁移状态和 Supabase Bucket 名称。
