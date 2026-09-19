# 通用文件与图片服务

本模块可供友链、头像或其他图片业务复用。存储不依赖任何业务表，访问权限和文件引用生命周期由调用方负责。

## 分层

| 模块 | 职责 |
| --- | --- |
| `storage/s3.ts` | 通用 S3 文件上传、读取、删除、按前缀分页列举 |
| `storage/index.ts` | 将当前 Supabase 环境变量映射到通用 S3 配置 |
| `media/images.ts` | 静态 PNG/JPEG/WebP 结构、大小与尺寸校验，计算 SHA-256 |
| `media/image-service.ts` | 不可变随机路径上传，返回元信息；下载验证摘要 |
| `rest/body.ts` | 按实际字节数和超时限制读取流 |

## 在新业务中复用

```ts
import { createImageService } from './image-service';
import { validateImage } from './images';
import { createObjectStorage } from '../storage';

// 调用方先验证用户身份/来源、限流，并有界读取文件。
const storage = createObjectStorage(env);
const images = createImageService(storage);
const image = await validateImage(bytes, declaredMime, {
  maxBytes: 1024 * 1024,
  maxWidth: 2048,
  maxHeight: 2048,
  maxPixels: 4_000_000,
});
const metadata = await images.save(image, 'avatars');
// metadata: { key, mime, size, hash }。保存到该业务记录，不直接视为公开 URL。

// 另一次请求：业务查询记录并判断是否允许访问，再返回图片。
return images.read(metadata);
```

`images.save` 接收 `validateImage` 的结果；不能把未经校验的请求对象当作已验证图片。原始文件上传（非图片）直接使用 `storage.put(key, { bytes, contentType })`，调用方必须制定自己的类型、大小与访问限制。

`createS3Storage(() => config)` 可直接配置其他 S3 兼容存储；协议客户端不限制 Supabase 域名。配置必须来自受信任服务端，不能让用户传入 endpoint 或 bucket。

接口均在请求中初始化并按需创建客户端。S3 调用有超时，关闭 SDK 自动重试以避免结果不明确的写入被隐藏；上层决定如何重试。下载必须传最大字节数，列表单页最多 100 条。响应默认 no-store，读取错误不暴露服务商响应或凭据。

校验检查容器与元信息，不解码/重新编码像素。对需要完整解码校验、元信息清除或格式转换的业务，应另外接入适合运行环境的图片处理服务。

不提供公开通用上传端点：每个业务的身份、验证码、配额不同。友链的上传入口保留在其申请接口；公共底层独立，避免任意上传接口变成公共文件托管服务。
