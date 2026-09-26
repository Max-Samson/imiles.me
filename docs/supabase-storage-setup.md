# 友链截图：Supabase Storage 配置说明

状态：已配置本地 S3 环境并验证只读连接。实际 Bucket 为 `YOUR_SUPABASE_STORAGE_BUCKET`，Region 为 `YOUR_SUPABASE_S3_REGION`；ListBuckets 与 ListObjectsV2 均返回 HTTP 200，后者返回 0 个对象。用户提供的 `bolg-s3` 查询返回 NoSuchBucket，未据此创建新 Bucket。尚未验证上传/删除、Bucket 私有设置或图片限制，也未配置生产 Worker secrets。友链服务端与单表迁移已实现，尚未部署。当前接口与配置以 [友链实现说明](./friend-links-design.md) 为准。

## 1. 项目与接入方式

- 项目 ID：从本地 `.env` 的 `SUPABASE_PROJECT_REF` 或 Supabase Dashboard 获取，不写入公开文档。
- 项目设置入口：`https://supabase.com/dashboard/project/<SUPABASE_PROJECT_REF>/settings/integrations`。进入项目后，从左侧 Storage 管理 Bucket，从 Settings → API Keys 获取服务端密钥。
- 项目默认 URL：`https://<SUPABASE_PROJECT_REF>.supabase.co`，配置时以控制台 Connect 显示的 Project URL 为准。
- 图片放 Supabase Storage；申请、邮箱、审核状态继续放 Cloudflare D1；审核登录继续使用 Cloudflare Access。

本项目已选择第 7 节的 S3 接入方式。第 2–6 节保留 Bucket 安全配置与原生 API 备选说明；其中 SUPABASE_SECRET_KEY 和原生 SDK 配置不用于当前 S3 方案。两种协议访问的是同一份 Storage 数据，无需将业务数据库迁到 Supabase。

```text
访客 → 本站 Worker（验证码、限流、图片校验）→ Supabase 私有 Bucket
                     ↓
                 D1 申请记录

图片请求 → 本站 Worker（D1 active / 管理员身份检查）→ Storage 下载 → 返回图片
```

## 2. 创建私有 Bucket

在该项目的 Storage 页面选择 New bucket，配置：

| 配置 | 值 |
| --- | --- |
| Name / ID | `friend-link-screenshots` |
| Public bucket | 关闭，即 Private |
| File size limit | `2097152` 字节，即 2 MiB |
| Allowed MIME types | `image/jpeg`、`image/png`、`image/webp` |

若控制台用 MB 显示，保存后通过 Bucket 配置确认实际限制字节数。项目全局上传限制必须不低于 Bucket 限制；不要为了此功能任意放宽其他 Bucket。

Bucket 限制只能作为补充。Worker 仍须校验文件实际类型、尺寸、动画格式与请求大小，规则见[友链设计](./friend-links-design.md)。[创建 Bucket 与限制上传](https://supabase.com/docs/guides/storage/buckets/creating-buckets)

对象路径约定 `screenshots/<服务端生成的随机 UUID>.<验证后的扩展名>`。不采用原文件名、邮箱或客户端传入的完整路径；上传设置 `upsert: false`，避免覆盖已审核图片。[标准上传](https://supabase.com/docs/guides/storage/uploads/standard-uploads)

## 3. 访问策略与密钥

在 Settings → API Keys 创建供此 Worker 使用的命名 Secret key，例如 `imiles-friend-links-worker`，保存 `sb_secret_...` 值。此名称便于轮换，**不代表密钥权限只限该 Bucket**：secret key 具有项目级高权限并绕过 RLS，只能用于受控服务端。不要使用前端 publishable key 代替它，也无需复制数据库密码或个人访问令牌。[API key 说明](https://supabase.com/docs/guides/getting-started/api-keys)

此功能不向 `anon`、`authenticated` 添加 Bucket 上传、读取、列举或删除策略。检查已有 `storage.objects` 策略，特别是未按 `bucket_id` 限定的宽泛规则，确认不会覆盖新 Bucket。不要直接删除其他功能依赖的策略，必要时缩小其范围。[Storage 访问控制](https://supabase.com/docs/guides/storage/security/access-control)

Private Bucket 配合上述策略阻止访客绕过 Worker 读取待审图片。Worker 使用高权限密钥，因此业务授权必须在调用 Storage 前完成；Supabase 无法直接根据另一服务 D1 中的审核状态作判断。

浏览器仅使用本站图片接口，不接收 secret key、public URL 或 signed URL。签名链接在有效期内可被持有者访问，不适用于首版“隐藏后新请求立即拒绝”的语义。[私有 Bucket 模型](https://supabase.com/docs/guides/storage/buckets/fundamentals)

## 4. Cloudflare Worker 配置

业务配置不写入 `wrangler.toml`。当前采用 S3 方案，endpoint、region 和 bucket 的非敏感默认值集中在 `src/server/config.ts`，允许同名环境变量覆盖；密钥仍由 Worker Secrets 注入。

以下原生 API secret 命令仅供原生 SDK 备选方案使用；当前 S3 凭据按第 7 节配置。

在仓库根目录通过交互输入配置生产密钥，避免把密钥放在命令参数、Git 或聊天记录里：

```sh
pnpm exec wrangler secret put SUPABASE_SECRET_KEY
```

当前 Worker 名为 `imiles`。若未来使用命名环境，变量和 secret 都需要配置到同一个目标环境；上述命令针对当前默认环境。执行 secret put 会修改远程配置，本次只提供说明，未执行。

后端实现必须同步完成：

1. `src/env.d.ts` 增加 `SUPABASE_URL`、`SUPABASE_STORAGE_BUCKET`、`SUPABASE_SECRET_KEY` 三个服务端字段。
2. `src/server/env.ts` 的 `getServerEnv` 显式传递这些字段；当前函数只返回既有字段，仅改类型或控制台变量还不够。
3. 请求从 `locals.runtime.env` 读取；本地脚本才使用受控 `process.env` 回退。禁止使用 `PUBLIC_` 前缀或在 React/客户端模块初始化特权客户端。
4. 配置缺失时图片能力返回明确的服务不可用错误，不能回退为公开 Bucket 或跳过上传。
5. 安装 SDK 时固定 `@supabase/supabase-js` 版本并提交锁文件，客户端仅在服务端创建，关闭 session persistence、auto refresh 和 URL session detection。不把请求中的用户 Authorization 头转发给此特权客户端。
6. 通过封装的图片存储模块执行 upload/download/list/remove，设置上游超时和脱敏错误；不回传 Supabase 错误正文或密钥。若采用原生 HTTP，遵循当前 API key 的 `apikey` 认证方式，不将 `sb_secret_...` 当作用户 JWT。

不需要给浏览器开通 Supabase 直传 CORS；上传和下载都由 Worker 代理。上线后观察额外网络延迟、Storage 容量和下载流量。

## 5. 本地开发

推荐使用独立测试 Supabase 项目及其私有 Bucket，避免测试清理误伤生产。若暂用同项目的 `friend-link-screenshots-dev`，它只隔离文件命名空间，项目级 secret 仍能访问生产数据。

本项目本地配置统一使用根目录 `.env`，当前 S3 字段如下，真实凭据只填写在本机：

```dotenv
SUPABASE_S3_ENDPOINT=https://<SUPABASE_PROJECT_REF>.storage.supabase.co/storage/v1/s3
SUPABASE_S3_REGION=YOUR_SUPABASE_S3_REGION
SUPABASE_STORAGE_BUCKET=YOUR_SUPABASE_STORAGE_BUCKET
SUPABASE_S3_ACCESS_KEY_ID=<S3 Access Key ID>
SUPABASE_S3_SECRET_ACCESS_KEY=<S3 Secret Access Key>
```

当前 `.env` 已被 Git 忽略，文件权限为仅属主可读写。不要给密钥添加 `PUBLIC_` 前缀。

当前 Astro Cloudflare 适配器通过 Wrangler `getPlatformProxy` 加载开发环境；在没有 `.dev.vars` 时，Wrangler 默认读取 `.env` 并注入 `locals.runtime.env`，现有 `getServerEnv` 已传递 S3 字段，无需改成构建时内联密钥。不要同时保留 `.dev.vars`，也不要设置 `CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV=false`。改名或修改变量后重启 `pnpm dev`。[本地环境变量规则](https://developers.cloudflare.com/workers/local-development/environment-variables/)

普通独立 Node 脚本不会自动读取 `.env`，需使用支持的 `node --env-file=.env` 或显式环境加载器。生产仍通过 Worker secrets 配置，部署不会自动把本机 `.env` 上传为生产密钥。

## 6. 配置后验证

先验证测试 Bucket，再联调友链接口。以下是实施后的验收步骤，本次尚未执行：

| 检查 | 预期 |
| --- | --- |
| 服务端读取 Bucket 配置 | ID 正确、public=false、限制为 2 MiB、MIME 白名单正确 |
| 通过服务端 SDK 上传一张自有小 PNG 到随机测试路径，再下载 | 上传成功，下载 SHA-256 与源文件一致 |
| 不带凭据直接访问对应 Storage 对象 | 无法取得图片字节，不能只看返回文案 |
| 使用 publishable key 读取、列举或上传至此 Bucket | 无法读取/写入测试对象；列举不得暴露对象 |
| 未审核、被拒绝或已隐藏的图片访问本站公开接口 | 404；管理员凭合法身份可预览待审图片 |
| 审核通过后访问本站图片接口 | 正确图片类型，nosniff，no-store |
| 超大或非白名单类型上传 | Worker 与 Bucket 各自的限制均有效 |
| 经 Storage API 删除本次随机测试对象，再下载 | 无法取得对象；不影响其他文件 |

清理必须使用 Storage API，不能仅用 SQL 删除 `storage.objects` 元信息，否则不等于删除真实文件。对象写入成功、D1 写入超时等部分失败，以及孤立文件回收，沿用设计文档的一致性规则。

完成后才能记录“Bucket 已配置、服务端读写已验证”。本次未修改远程资源，仅执行 S3 只读连通检查；当前验证结果以文档开头为准。

## 7. 使用 S3 协议连接同一个 Bucket

用户提供的地址是 S3 API endpoint，不是 Bucket 名或可直接展示图片的 URL：

```text
https://<SUPABASE_PROJECT_REF>.storage.supabase.co/storage/v1/s3
```

在该项目 Storage → Settings 的 S3 配置区域启用 S3 连接（若尚未启用），创建 S3 Access Keys，复制 Access Key ID、Secret Access Key 与 Region。控制台具体栏目以当前界面为准。S3 密钥不是前文的 `sb_secret_...`，两者不能替换使用。[S3 认证说明](https://supabase.com/docs/guides/storage/s3/authentication)

| 客户端参数 | 值 |
| --- | --- |
| Endpoint | 上述完整地址，保留 `/storage/v1/s3` |
| Region | 从 S3 配置页复制，不能根据项目 ID 推断或填 `auto` |
| Bucket | 实际创建的 Bucket ID；按本指南创建时为 `friend-link-screenshots` |
| Access Key ID | 控制台生成的 S3 Access Key ID |
| Secret Access Key | 与该 ID 配对的 S3 Secret Access Key |
| Path-style addressing | 开启，AWS SDK 对应 `forcePathStyle: true` |
| Signature | AWS Signature Version 4（SigV4） |

无需注册 AWS 账号。S3 在这里是连接协议，文件仍存放在 Supabase。控制台生成的 S3 密钥可访问项目内全部 Bucket，并绕过 RLS，只允许服务端或本机受控客户端持有；Bucket 保持 Private。

服务端 AWS SDK v3 示例（实施时安装并锁定 `@aws-sdk/client-s3` 版本；以下不是已接入的业务代码）：

```ts
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';

// env 来自已校验的服务端运行环境，不能传入浏览器。
const client = new S3Client({
  endpoint: env.SUPABASE_S3_ENDPOINT,
  region: env.SUPABASE_S3_REGION,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.SUPABASE_S3_ACCESS_KEY_ID,
    secretAccessKey: env.SUPABASE_S3_SECRET_ACCESS_KEY,
  },
});

// 只读连通检查。成功且对象列表为空也表示已连接。
await client.send(new ListObjectsV2Command({
  Bucket: env.SUPABASE_STORAGE_BUCKET,
  MaxKeys: 1,
}));
```

使用此协议时，非敏感配置增加 `SUPABASE_S3_ENDPOINT`、`SUPABASE_S3_REGION`，继续使用 `SUPABASE_STORAGE_BUCKET`。S3 凭据通过以下交互命令存入 Worker secrets，不在命令行参数中填写真实值：

```sh
pnpm exec wrangler secret put SUPABASE_S3_ACCESS_KEY_ID
pnpm exec wrangler secret put SUPABASE_S3_SECRET_ACCESS_KEY
```

仅使用 S3 客户端时，不需要前文原生 API 方案的 `SUPABASE_SECRET_KEY`；环境类型和 `getServerEnv` 应改为传递实际选择的 S3 配置字段。不要混用两种 SDK 的选项，例如 `upsert: false` 是原生 Storage SDK 的参数，不是 S3Client 的参数。上传继续使用随机、不可变对象路径。

常见问题：`SignatureDoesNotMatch` 先核对 Region、完整 endpoint、密钥配对与本机时间；`NoSuchBucket` 核对实际 Bucket ID；匿名浏览器直接打开 endpoint 不能作为连通验证。Supabase 支持常用 S3 操作，但并非所有 AWS S3 特性，使用前核对[兼容列表](https://supabase.com/docs/guides/storage/s3/compatibility)。

当前 endpoint、region 与 bucket 均通过环境变量传入，并由存储装配层执行必填校验；源码不保存项目级默认值。S3 凭据仅存于被 Git 忽略的本机 `.env`，未写入文档或远程 Worker。只读连接已通过；未验证写入权限。密钥已在聊天中出现，建议轮换后更新本机和生产 secrets。
