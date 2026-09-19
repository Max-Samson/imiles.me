import type { APIContext } from 'astro';
import type { CloudflareEnv } from '../../env.d';
import { getServerEnv } from '../env';

/**
 * 标准化 REST 请求上下文接口
 *
 * 【前端视角通俗解释】：
 * 在前端组件里，我们常通过 `useLocation()` 或 `useParams()` 获取当前路由、参数和用户信息。
 * 服务端也是类似：当一个 HTTP 请求到达 Astro API 端点（如 `src/pages/api/v1/xxx.ts`）时，
 * 原生的 `APIContext` 包含很多零散属性（如 headers、clientAddress、locals、url 等）。
 * 我们通过 `RestContext` 把这些元数据清洗打包成一个干净、强类型的对象，
 * 后续所有业务逻辑只需要读取这个对象，避免到处手写 `headers.get('...')`。
 */
export interface RestContext {
  /** 请求全局链路追踪唯一 ID（优先使用 Cloudflare Ray ID，便于在控制台排查链路） */
  requestId: string;
  /** 客户端真实 IP 地址（优先提取 Cloudflare 的 CF-Connecting-IP 标头） */
  clientIp: string;
  /** 客户端浏览器 User-Agent 字符串 */
  userAgent: string;
  /** HTTP 请求方法动词（GET, POST, PUT, DELETE 等） */
  method: string;
  /** 标准 URL 解析对象，可轻松读取 pathname, searchParams 等 */
  url: URL;
  /** Cloudflare 运行时绑定的数据库 D1、缓存 KV 与环境变量 */
  env: CloudflareEnv;
  /** 请求到达服务端的毫秒时间戳 */
  timestamp: number;
}

/**
 * 从 Astro 原生 APIContext 中构造标准化执行上下文
 *
 * @param context Astro API 路由入参 APIContext
 * @returns 格式化后的 RestContext 上下文对象
 */
export function createRestContext(context: APIContext): RestContext {
  const request = context.request;
  const headers = request.headers;

  // 1. 提取或生成请求唯一 Trace ID（便于全链路排查日志）
  const requestId =
    headers.get('x-request-id') ??
    headers.get('cf-ray') ??
    `req_${crypto.randomUUID().slice(0, 12)}`;

  // 2. 提取客户端真实 IP（Cloudflare 代理下优先读取 cf-connecting-ip）
  const clientIp =
    headers.get('cf-connecting-ip') ??
    context.clientAddress ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '127.0.0.1';

  const userAgent = headers.get('user-agent') ?? 'unknown';

  // 3. 安全获取 Cloudflare D1 / KV 绑定
  const env = getServerEnv(context.locals);

  return {
    requestId,
    clientIp,
    userAgent,
    method: request.method,
    url: new URL(request.url),
    env,
    timestamp: Date.now(),
  };
}
