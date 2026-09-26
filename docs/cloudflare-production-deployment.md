# Cloudflare 生产部署配置

本文对应当前 `imiles.me` 实现，覆盖 Worker、D1、KV、Rate Limiting、Cloudflare Access、Turnstile 和 Supabase S3。所有命令均在仓库根目录执行。本文只说明操作，不代表远程资源已经创建或迁移。

## 1. 当前部署模型

```text
imiles.me
  └─ Cloudflare Custom Domain
       └─ Worker: imiles
            ├─ Static Assets: dist/
            ├─ D1 binding: DB → <D1_DATABASE_NAME>
            ├─ KV binding: KV → <KV_NAMESPACE_NAME>
            ├─ KV binding: SESSION → 独立 Session namespace
            ├─ Rate Limit binding: FRIEND_LINK_RATE_LIMITER
            └─ Supabase S3 私有 Bucket

/admin*、/api/v1/admin*
  └─ Cloudflare Access
       └─ Worker 再验证 Cf-Access-Jwt-Assertion 和业务能力
```

`wrangler.toml` 已关闭 `workers.dev` 和 Preview URL，并把 `imiles.me` 配置为 Custom Domain。公开站点不经过 Access 登录，只有后台页面和管理 API 受保护。

## 2. 上线前必须补齐 SESSION KV

Astro Cloudflare adapter 默认注入 `cloudflare-kv-binding` Session 驱动，并读取名为 `SESSION` 的 binding。当前代码没有使用 Astro Session，但生产 Worker 仍应提供该 binding，避免运行时出现 `Invalid binding SESSION`。

推荐创建独立 namespace：

```bash
pnpm exec wrangler kv namespace create <SESSION_KV_NAMESPACE_NAME> \
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

## 3. 核对现有 Worker 资源

当前 `wrangler.toml` 预期以下资源都属于部署账号：

| Binding | 远程资源 | 当前用途 |
| --- | --- | --- |
| `DB` | 生产 D1，名称从本地 `.env` 获取 | 友链申请与审核记录 |
| `KV` | 业务 KV，名称从本地 `.env` 获取 | 通用缓存 |
| `SESSION` | 新建独立 KV | Astro adapter Session 驱动 |
| `FRIEND_LINK_RATE_LIMITER` | namespace `1001` | 友链申请近似限流，5 次/60 秒 |
| `ASSETS` | `dist/` | Astro 静态资源 |

先确认当前 Wrangler 登录账号：

```bash
pnpm exec wrangler whoami
```

如果 D1 或 KV 不属于该账号，不要直接部署。先将 `database_id`、KV `id` 替换为正确生产资源。Rate Limiting binding 只由 Wrangler 配置，当前不会显示在 Dashboard 的普通 binding 列表中；`namespace_id` 必须是账号内自行分配的正整数字符串，不能与其他无关限流器复用。

## 4. 创建 Turnstile Widget

Cloudflare Dashboard → **Turnstile** → **Add widget**：

1. Name：使用本地 `.env` 中的 `CLOUDFLARE_TURNSTILE_WIDGET_NAME`。
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

## 5. 创建 Cloudflare Access 后台应用

### 5.1 配置登录方式

Cloudflare Zero Trust → **Integrations → Identity providers**。

个人站点首版可以启用 One-time PIN；也可以使用 Google 或 GitHub IdP。只有登录方式还不够，Allow Policy 必须继续限制精确管理员邮箱。

### 5.2 创建管理员策略

Zero Trust → **Access controls → Policies**：

1. Policy name：`imiles-admin-owners`。
2. Action：`Allow`。
3. Include：`Emails`。
4. 填写精确管理员邮箱。
5. Session duration：建议 4–8 小时。

不要使用仅包含 `Login Methods = One-time PIN` 的 Allow 策略，也不要使用宽泛邮箱域名规则。

### 5.3 创建 Self-hosted Application

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
- 记录 Application Audience (AUD) tag。

Worker 会继续验证 `Cf-Access-Jwt-Assertion` 的签名、issuer、audience、过期时间和管理员白名单。Access 层放行并不等于跳过 Worker 授权。

官方文档：[创建 Self-hosted Application](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/self-hosted-public-app/)、[路径匹配](https://developers.cloudflare.com/cloudflare-one/access-controls/policies/app-paths/)、[JWT 验证字段](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)。

## 6. 配置 Worker Secrets

当前 `pnpm deploy` 没有传 `--keep-vars`，因此不要只在 Dashboard 添加普通 plaintext variables；后续 Wrangler 部署可能删除未写在配置文件中的普通 vars。为保持当前仓库约定，下面的生产配置统一使用 Worker Secrets。

### 6.1 必需配置

| Secret | 值 |
| --- | --- |
| `ENVIRONMENT` | `production` |
| `ACCESS_ISSUER` | `https://<team-name>.cloudflareaccess.com`，不能有尾部 `/` |
| `ACCESS_AUD` | `imiles-admin` 的 AUD tag |
| `ADMIN_EMAILS` | 与 Access Allow Policy 一致的邮箱，多个用逗号分隔 |
| `TURNSTILE_SITE_KEY` | Widget 的公开 Site Key |
| `TURNSTILE_SECRET_KEY` | Widget 的 Secret Key |
| `SUBMISSION_HMAC_SECRET` | 至少 32 字符的随机密钥 |
| `SUPABASE_S3_ACCESS_KEY_ID` | Supabase Storage S3 Access Key ID |
| `SUPABASE_S3_SECRET_ACCESS_KEY` | 对应的 S3 Secret Access Key |

生成 HMAC Secret：

```bash
openssl rand -base64 32
```

可以逐项交互输入：

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

`wrangler secret put` 会生成并部署新的 Worker version。已有线上 Worker 时，建议在 Dashboard 一次性添加，或使用一个被 Git 忽略、使用后立即删除的临时文件执行 `wrangler secret bulk`，避免九次独立部署。不要把真实值写进命令参数、Git 或文档。

### 6.2 当前无需设置

- `SITE_URL`：生产默认值已经是 `https://imiles.me`。
- `SUPABASE_S3_ENDPOINT`：代码已有当前 Supabase 项目 endpoint。
- `SUPABASE_S3_REGION`：必须配置，源码不提供项目级默认值。
- `SUPABASE_STORAGE_BUCKET`：必须配置，源码不提供项目级默认值。
- `APP_SECRET`：当前功能没有使用。

若实际生产 Bucket、Region 或项目与默认值不同，必须通过同名 Secret 覆盖，不能继续使用错误默认值。

检查 Secret 名称，不会显示 Secret 内容：

```bash
pnpm exec wrangler secret list
```

官方文档：[Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)、[Wrangler secret bulk](https://developers.cloudflare.com/workers/wrangler/commands/workers/)。

## 7. 核对 Supabase Storage

当前服务端默认使用：

```text
Endpoint: https://<SUPABASE_PROJECT_REF>.storage.supabase.co/storage/v1/s3
Region: YOUR_SUPABASE_S3_REGION
Bucket: YOUR_SUPABASE_STORAGE_BUCKET
对象前缀: friend-links/screenshots/
```

上线前确认：

1. `YOUR_SUPABASE_STORAGE_BUCKET` 存在并保持 Private。
2. S3 Access Key 仍有效，并与 Secret Access Key 配对。
3. Worker 使用的 S3 密钥有上传、下载、列举和删除权限。
4. 浏览器不能匿名读取 Bucket 对象。
5. 若此前密钥曾出现在聊天、日志或截图中，先轮换再配置生产 Secret。

Worker 会检查图片真实格式、尺寸、文件大小与 SHA-256；Bucket 的 MIME/大小限制只是第二层保护。

详细说明见 [Supabase Storage 配置](./supabase-storage-setup.md)。

## 8. 应用生产 D1 迁移

先检查待应用迁移：

```bash
pnpm exec wrangler d1 migrations list <D1_DATABASE_NAME> --remote
```

确认目标确实是生产 D1 后执行：

```bash
pnpm exec wrangler d1 migrations apply <D1_DATABASE_NAME> --remote
```

Wrangler 会记录已应用迁移；官方说明 apply 前会确认并创建备份，单个失败迁移会回滚。不要用 `d1 execute` 手工复制迁移 SQL，也不要只上传 Drizzle meta 文件。

官方文档：[D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/)、[Wrangler D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/)。

## 9. 构建和部署

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

## 10. 第三方审核工具（可选）

站内后台登录不需要 Service Token。只有外部审核工具或无人值守客户端接入管理 API 时才配置：

1. Zero Trust → **Access controls → Service credentials → Service Tokens**。
2. 创建 `imiles-review-tool`，立即保存 Client ID 和 Client Secret。
3. 在 `imiles-admin` Access Application 增加 Action 为 `Service Auth` 的 Policy，Include 该 Service Token。
4. Worker 增加：

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

## 11. 上线验收

按顺序检查：

1. `https://imiles.me/` 和 `/friends` 可匿名访问，不跳转 Access。
2. 未登录访问 `/admin`、`/admin/`、`/api/v1/admin/session` 均进入 Access 或返回身份错误。
3. 管理员登录后 `/api/v1/admin/session` 返回 user Actor 和三项 capability，不返回 JWT 或配置。
4. 非 `ADMIN_EMAILS` 用户即使通过 IdP，也无法进入 Worker 管理接口。
5. `/friends` 能加载 Turnstile；提交后返回 201，重复幂等请求返回 200。
6. D1 中产生 `pending` 申请；待审截图只有管理接口可读。
7. 审核通过后公开列表和公开截图可见；隐藏后公开截图返回 404。
8. 连续提交触发限流时返回 429 和 `Retry-After: 60`。
9. `https://<worker>.workers.dev` 与 Preview URL 无法作为旁路入口。
10. Zero Trust Access logs 和 Workers Logs 中没有 JWT、Cookie、S3 密钥或完整请求正文。

退出地址：

```text
https://imiles.me/cdn-cgi/access/logout
```

出现问题时优先检查：Access 应用路径、AUD、issuer 是否有尾部斜杠、管理员邮箱两处是否一致、`SESSION` binding、Turnstile hostname/action、D1 迁移状态和 Supabase Bucket 名称。
