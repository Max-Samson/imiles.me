import { submit } from '../../../server/friend-links/routes';

/**
 * 公开友链申请提交 API
 *
 * 路径: POST /api/v1/friend-link-applications
 * 权限: 公开无需鉴权（需通过同源检查与 Turnstile 人机校验）
 *
 * 供访客提交友链申请，包含以下安全保障：
 * 1. 同源检查（Sec-Fetch-Site / Origin 验证）
 * 2. Cloudflare Turnstile 人机验证
 * 3. IP 级提交频率限流
 * 4. Idempotency-Key 幂等校验与防重复提交
 * 5. 申请成功后异步触发管理员邮件通知
 */
export const prerender = false;

export const ALL = submit;
