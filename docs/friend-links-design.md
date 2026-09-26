# 友链：单表数据模型与服务端实现

状态：单表 schema、迁移、服务端 API、公开友链页和申请表已实现；审批使用受保护 API，第三方审核工具尚待接入。未执行生产迁移或部署。申请表需要配置 Turnstile site key，图片写入和删除尚未在真实 Bucket 验证。配置步骤见 [Supabase Storage](./supabase-storage-setup.md)。

## 1. 流程与边界

申请人提交链接、简介、邮箱，可附一张博客首屏截图。站主通过 Cloudflare Access 登录后审批；公开列表仅展示审核通过的记录。邮箱不公开。不自行建设用户账号或密码系统。

```text
pending ──approve──> active ⇄ hidden
   └──────reject───> rejected
```

`active` 表示审核通过且展示，`hidden` 保留审核通过历史但不展示。拒绝后不重新打开，申请人可提交新记录。申请人自行提供截图；没有自动抓取或自动截图。首版没有公开内容编辑、自动邮件、自助进度查询或删除业务记录。管理员可在审核页点击联系邮箱，使用自己的邮件客户端手动沟通。

## 2. 一张 friend_links 表

申请和展示共用一条记录，不创建申请表、公开快照表或上传表。公开数据通过明确的查询投影隔离，不能将整行对象直接返回前端。

| 字段 | 约束 / 含义 |
| --- | --- |
| id | TEXT 主键，完整随机 UUID + `fl_` 前缀 |
| name | 博客名称 / 站长称呼，纯文本，可空，1–50 字符 |
| submitted_url / canonical_url | 提交 URL / 规范化 URL，必填 |
| description | 纯文本，1–200 字符 |
| status | pending / active / rejected / hidden，默认 pending |
| screenshot_key | 可空，私有对象路径 |
| screenshot_mime / screenshot_bytes / screenshot_sha256 | 类型、大小、内容摘要；与 key 全部存在或全部为空 |
| submission_key_hash | 幂等键摘要，唯一 |
| submission_payload_hash | 文本输入和图片摘要的指纹，不含验证码 |
| version | 正整数，每次审核、可见性变更及图片清理递增 |
| reviewed_by / reviewed_at | 首次审批身份 / 毫秒时间；pending 为空，已处理非空 |
| published_at | 首次通过时间，隐藏/恢复不重置；pending/rejected 为空 |
| updated_by | 最近管理状态操作人；初始为空 |
| created_at / updated_at | 创建 / 更新时间，毫秒整数 |

数据库 CHECK 约束兜底状态、版本、名称、简介、邮箱长度、审核信息、发布时间和图片元信息的一致性。图片允许 JPEG/PNG/WebP，1 字节至 2 MiB。
索引：

- `submission_key_hash` 唯一，处理提交重试和并发。
- `canonical_url` **部分唯一索引**，仅 `status IN ('active','hidden')` 生效。待审和被拒绝记录不占用网址；隐藏记录仍占用，避免重复收录。
- `screenshot_key` 唯一（允许多个 NULL），每条申请独立拥有自己的对象。
- `(status, created_at, id)` 用于管理列表。
- `(status, published_at, id)` 用于公开列表。
- `(canonical_url, status)` 支持后续同站历史查询。

Schema：`src/server/db/schema/friend-links.ts`。迁移：`drizzle/migrations/0000_friend_links.sql`；由 Drizzle 生成，包含 journal/snapshot。目前只在临时本地 D1 中验证。

## 3. 审核一致性

每次操作只执行一条条件 UPDATE：匹配 `id + 原状态 + expectedVersion`，成功后版本 +1。通过审批时同时写入 active、审批人/时间和 published_at，无需跨表事务。

- approve / reject 仅接受 pending。
- hide 仅接受 active；restore 仅接受 hidden。
- 版本失配或状态已变化返回 409。
- 同网址已存在 active/hidden 记录时，数据库唯一约束阻止审批，返回 409；失败 UPDATE 不改变原 pending 状态。
- 网络失败后管理员先 GET 最新状态，再决定后续操作。

公开列表只查询 active，返回 `id、name、url、description、screenshotUrl`；若 name 为空标题可由前端从 URL 派生域名。邮箱、审批人、幂等摘要、存储路径不进入公开响应。

`POST /api/v1/friend-link-applications` 使用 multipart/form-data：

| 字段 | 要求 |
| --- | --- |
| url | HTTPS，最多 2048 字符；拒绝账号密码、非默认端口、IP、本地域名、query/fragment |
| description | 去首尾空白，纯文本 1–200 字符 |
| email | 去首尾空白，格式有效，最多 254 字符；不是所有权验证 |
| turnstileToken | 必填，最大 2048 字符 |
| screenshot | 可选一个文件，最大 2 MiB |

请求头必须有 UUID 格式 `Idempotency-Key` 和匹配站点配置的 `Origin`。总请求限制 3 MiB，文本部分限制 8 KiB；拒绝重复字段、未知字段和客户端设置审核状态。按实际流字节数读取，15 秒读取超时，不信任 Content-Length。

URL 使用 WHATWG URL 规范化域名、默认端口与尾部斜杠，保留子域名、www 和路径大小写。不抓取或探测申请网站。

处理顺序：同源检查 → HMAC 来源限流 → 有界解析/图片校验 → 幂等查询 → Turnstile → 存储截图 → 插入 pending。

同键同内容返回原回执，不再消费旧验证码或上传；同键不同内容返回 409。成功重试始终只返回 id 和“已收到”，不泄漏后续审核结果。并发由唯一索引兜底。

Turnstile 服务端校验 success、hostname、action，5 秒网络超时；失败不落库。限流使用 `FRIEND_LINK_RATE_LIMITER`，初始 5 次/分钟/来源，来源 IP 经专用 HMAC 后用于 key，不写入业务表。不将其当成全网精确配额，不用 KV 实现原子计数。缺少配置或上游异常时不放行。

## 5. 图片是通用服务端能力

```text
rest/body.ts                 有大小与时间上限的流读取
media/images.ts              JPEG/PNG/WebP 校验、可配置尺寸/大小限制、摘要
storage/s3.ts                通用 S3 put/get/remove/list，限时请求、脱敏异常
storage/index.ts             从当前环境装配 S3 配置
media/image-service.ts       随机路径上传、元信息返回、完整性验证下载
friend-links/service.ts      友链幂等、访问权限、业务引用与清理策略
```

通用模块不依赖友链表或审批状态，其他业务可以使用不同对象前缀及图片限制；没有无鉴权的全站上传入口。复用方式见 [通用文件与图片服务](../src/server/media/README.md)。

友链前缀为 `friend-links/screenshots/`，服务端生成随机 key，不采用文件原名或邮箱。默认限制宽高各 4096、总像素 1200 万，拒绝动画 WebP/APNG、GIF、SVG。检查文件签名、容器边界、PNG CRC、声明 MIME、尺寸和文件摘要；不解码像素、不转码，不保证检查出所有编码层损坏，页面需要无图降级。

实际存储：Supabase `YOUR_SUPABASE_STORAGE_BUCKET`，Region `YOUR_SUPABASE_S3_REGION`。上线前必须核验 Bucket 为 Private，且普通用户/匿名 Storage RLS 策略不允许绕过 Worker。S3 凭据具有项目级权限，不能下发客户端。当前仅验证过只读连接，未修改远程 Bucket 权限。

每次图片 GET 先查记录；公开端只有 active 可读，管理端需要验证 Access JWT。通过 Worker 返回二进制，不下发公开或签名存储 URL；响应 no-store/nosniff。隐藏后新请求被拒绝，无法收回此前下载的副本。

## 6. S3 与 D1 部分失败、清理

两者不共享事务。先写 S3、再插入 D1，上传失败不创建申请。随机对象不覆盖已有对象。数据库调用超时或提交结果不明确时不立即删图，以免删除已提交的引用；由维护流程回收。

幂等插入明确冲突时读取胜出记录，并删除本次未被引用的随机对象。清理失败保留孤立文件，成功的申请仍可返回回执。

`POST /api/v1/admin/friend-links/cleanup` 为受保护维护入口：

1. 每次解除最多 100 条已拒绝超过 7 天的图片引用，清空整组图片元信息并递增版本；rejected 无法恢复，不与审批竞争。
2. 每页最多扫描 20 个友链专属对象，仅删除超过 24 小时且 D1 中没有引用的对象。已通过、隐藏和待审图片保留。
3. 返回 `detached、removed、nextCursor`；携带 cursor 继续扫描，直至 null。删除失败可重试，按新一轮扫描也能重新发现孤立对象。

建议每日运行维护接口，目前没有自动调度。不要给整个 Bucket 设置统一过期删除规则。邮箱保留 180 天的清理策略尚未自动实现，需后续确认。

## 7. 接口契约

统一成功响应 `{ success: true, data, meta }`，错误使用现有错误结构。列表 `data` 为 `{ items, page, pageSize, hasNextPage }`，页大小默认 20、最大 100，页数最大 10000。

| 方法与路径 | 权限 / 参数 |
| --- | --- |
| GET `/api/v1/friend-links` | 公开 active 列表，page/pageSize |
| POST `/api/v1/friend-link-applications` | 公开提交 + 同源/限流/验证码，首次 201、重试 200 |
| GET `/api/v1/friend-links/:id/screenshot` | active 图片，其他状态或无图 404 |
| GET `/api/v1/admin/friend-links` | 管理列表，page/pageSize/status |
| GET `/api/v1/admin/friend-links/:id` | 管理详情，含联系邮箱 |
| PATCH `/api/v1/admin/friend-links/:id` | JSON `{ action: approve/reject/hide/restore, expectedVersion }` |
| GET `/api/v1/admin/friend-links/:id/screenshot` | 管理预览 |
| POST `/api/v1/admin/friend-links/cleanup` | JSON `{}` 或 `{ cursor }` |

管理接口验证 Access JWT 签名、RS256、issuer、audience、exp/iat/sub，以及管理员邮箱或 Service Token Client ID 白名单。不信任裸 email header；workers.dev 等旁路同样执行验证。管理员浏览器写操作要求同源 Origin；已验证的 Service Token 可在没有 Origin 的桌面/服务端客户端写入，携带 Origin 时仍须同源。写入使用 JSON，CORS 不代替身份验证。所有接口 no-store，429 附 Retry-After: 60。

## 8. 配置与上线步骤

部署文件仅保留 Worker 路由和 D1/KV/限流等平台绑定，不声明业务 `[vars]`。

- `src/config/app.ts`：统一站点地址和 Turnstile action，供 Astro、后端与后续前端验证码组件共享。
- `src/server/config.ts`：Supabase 非敏感连接默认值；验证码 hostname 自动从已验证的站点地址提取，不单独配置。
- `SITE_URL` 仅作为本地/预发布的可选环境覆盖，例如本地 `.env` 中的 `http://localhost:4321`；不会信任请求 Host/Origin 来推导允许来源。
- S3 endpoint/region/bucket 可通过现有同名环境变量覆盖，正常生产部署无需重复填写。

以下身份与密钥信息仍从运行环境读取：

| 变量 | 来源 |
| --- | --- |
| `ACCESS_ISSUER` | `https://你的团队.cloudflareaccess.com`，不带尾部斜杠 |
| `ACCESS_AUD` | Access 自托管应用 audience |
| `ADMIN_EMAILS` | 逗号分隔的允许登录邮箱 |
| `ADMIN_SERVICE_TOKEN_IDS` | 可选，逗号分隔的 Cloudflare Access Service Token Client ID；仅供第三方审核工具调用管理 API |
| `ADMIN_SERVICE_TOKEN_CAPABILITIES` | 可选 JSON 对象，按 Client ID 显式授予 `admin:read`、`admin:write`、`admin:maintenance`；未配置时 Service Token 无业务权限 |
| `TURNSTILE_SITE_KEY` | Turnstile 公开 site key，由 Worker 在渲染申请页时传给浏览器 |
| `TURNSTILE_SECRET_KEY` | Turnstile secret，使用 Worker Secret |
| `SUBMISSION_HMAC_SECRET` | 至少 32 字符随机密钥，使用 Worker Secret |
| `SUPABASE_S3_ACCESS_KEY_ID` / `SUPABASE_S3_SECRET_ACCESS_KEY` | S3 凭据，生产用 Worker Secrets |

Access 应用需覆盖 `/api/v1/admin/*`。前端 Turnstile action 复用 `appConfig.turnstile.actions.friendLinkSubmit`，hostname 由站点配置推导。本地测试没有认证绕过开关，自动测试使用隔离 D1 和模拟外部依赖。

公开页 `/friends`（中文 `/zh/friends`）调用公开列表 API，显示全部已通过审核的友链，并提供名称、网址和简介搜索。申请弹窗提交站点信息及可选截图，使用浏览器端 Turnstile token；缺少 `TURNSTILE_SITE_KEY` 时禁用提交。该公开 site key 由当前请求的 Worker 环境提供，`TURNSTILE_SECRET_KEY` 仅用于服务端校验。两者均需在目标环境配置，且 site key 对应的 Turnstile Widget 需允许站点域名。

第三方审核工具应通过现有管理 API 展示待审记录、申请截图和联系邮箱，使用 `expectedVersion` 执行批准、拒绝、隐藏或恢复，不直接修改 D1。Cloudflare Access 和 API 自身的 JWT 验证仍要生效。对托管工具，可在 Access 为管理 API 建立专用 Service Auth 策略，将工具的 Service Token Client ID 放入 `ADMIN_SERVICE_TOKEN_IDS`，再通过 `ADMIN_SERVICE_TOKEN_CAPABILITIES` 授予所需的最小能力，例如 `{"review-tool.access":["admin:read","admin:write"]}`。服务端仅接受签名有效、受众匹配、Client ID 在白名单且拥有对应能力的服务令牌，审核人记录为 `service:<Client ID>`。Client Secret 只能配置在第三方工具的私密凭据中。当前没有邮件服务或自动通知，需要联系申请人时手动发送邮件。

验证命令：`pnpm test:server`、`pnpm check:server`、`pnpm db:check`、`pnpm build`。绑定变化运行 `pnpm cf:types`。实际开发库迁移使用 `pnpm db:migrate:local`，正式库迁移与部署另行执行。先配置测试环境并验证 Bucket 私有权限、Access 和 Turnstile，再正式上线。
