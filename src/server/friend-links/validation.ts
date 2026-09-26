import { isIP } from 'node:net';
import { z } from 'astro/zod';
import { friendLinkStatuses } from '../db/schema/friend-links';
import { ValidationError } from '../errors';

export function canonicalizeUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ValidationError('网站链接必须是有效的 HTTPS URL');
  }
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash ||
    !host.includes('.') ||
    host.endsWith('.') ||
    host.startsWith('[') ||
    isIP(host) ||
    /(?:^|\.)(localhost|local|internal|test|invalid|example|onion)$/.test(host)
  ) {
    throw new ValidationError('网站链接须为公开 HTTPS 域名，不含凭据、参数、片段或非默认端口');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}
export const submissionSchema = z
  .object({
    name: z.string().trim().min(1).max(50).optional(),
    url: z.string().trim().min(1).max(2048),
    description: z.string().trim().min(1).max(200),
    email: z.string().trim().email().max(254),
    turnstileToken: z.string().min(1).max(2048),
  })
  .strict();
export const idempotencySchema = z
  .string()
  .uuid()
  .transform((s) => s.toLowerCase());
export const entityIdSchema = z.string().regex(/^fl_[a-f0-9]{32}$/);
export const reviewSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'hide', 'restore']),
    expectedVersion: z
      .number()
      .int()
      .positive()
      .max(Number.MAX_SAFE_INTEGER - 1),
  })
  .strict();
export type ReviewAction = z.infer<typeof reviewSchema>['action'];
const intQuery = (fallback: number, max: number) =>
  z
    .string()
    .regex(/^[1-9]\d*$/)
    .transform(Number)
    .pipe(z.number().int().max(max))
    .optional()
    .transform((v) => v ?? fallback);
export function parseListQuery(url: URL, admin = false) {
  const params: Record<string, string> = {};
  for (const [key, value] of url.searchParams) {
    if (key in params) throw new ValidationError('查询参数不能重复');
    params[key] = value;
  }
  return z
    .object({
      page: intQuery(1, 10000),
      pageSize: intQuery(20, 100),
      ...(admin ? { status: z.enum(friendLinkStatuses).optional() } : {}),
    })
    .strict()
    .parse(params) as {
    page: number;
    pageSize: number;
    status?: (typeof friendLinkStatuses)[number];
  };
}
