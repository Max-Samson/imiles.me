import { z } from 'astro/zod';
import { getSiteUrl } from '../config';
import { createEmailService } from '../email';
import { InternalServerError, ValidationError } from '../errors';
import { defineRestRoute, readJsonBody } from '../rest';
import { authorizeAdmin, authorizeAdminMutation } from '../security/access';
import { requireSameOrigin } from '../security/origin';
import { createObjectStorage } from '../storage';
import { jsonSuccess } from '../types';
import { limitSubmission, verifyTurnstile } from './protection';
import { friendLinkRepository } from './repository';
import { friendLinkService } from './service';
import { readSubmission } from './upload';
import {
  entityIdSchema,
  idempotencySchema,
  notifySchema,
  parseListQuery,
  reviewSchema,
} from './validation';

/** 请求级装配：绑定来自当前 Worker 请求，Service 本身不依赖 Astro 或 Cloudflare 环境。 */
function createFriendLinks(env: Parameters<typeof friendLinkRepository>[0]) {
  return friendLinkService(friendLinkRepository(env), createObjectStorage(env));
}

export const publicList = defineRestRoute({
  GET: async (ctx) => {
    const query = parseListQuery(ctx.url);
    return jsonSuccess(await createFriendLinks(ctx.env).listPublished(query.page, query.pageSize));
  },
});

export const submit = defineRestRoute({
  POST: async (ctx, route) => {
    requireSameOrigin(route.request, ctx.env);
    await limitSubmission(ctx);
    const key = idempotencySchema.parse(route.request.headers.get('Idempotency-Key'));
    const input = await readSubmission(route.request);
    const { created, ...receipt } = await createFriendLinks(ctx.env).submit(input, key, () =>
      verifyTurnstile(input.turnstileToken, ctx.env),
    );

    // 新申请提交时，异步通知管理员（若已配置发信）
    if (created) {
      await ctx.defer(async () => {
        const emailService = createEmailService(ctx.env);
        const resolved = getSiteUrl(ctx.env);
        const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(resolved.hostname);
        const siteOrigin = isLoopback ? 'https://imiles.me' : resolved.origin;
        const adminUrl = `${siteOrigin}/admin/friend-links/${receipt.id}`;
        await emailService.sendAdminNewApplication({
          applicantName: input.name,
          applicantUrl: input.url,
          applicantEmail: input.email,
          description: input.description,
          detailUrl: adminUrl,
        });
      });
    }

    return jsonSuccess(receipt, {
      status: created ? 201 : 200,
      ...(created ? { headers: { Location: `/api/v1/admin/friend-links/${receipt.id}` } } : {}),
    });
  },
});

export const adminList = defineRestRoute({
  GET: async (ctx, route) => {
    await authorizeAdmin(route.request, ctx.env, 'admin:read');
    const query = parseListQuery(ctx.url, true);
    return jsonSuccess(
      await createFriendLinks(ctx.env).listAdmin(query.page, query.pageSize, query.status),
    );
  },
});

export const adminDetail = defineRestRoute({
  GET: async (ctx, route) => {
    await authorizeAdmin(route.request, ctx.env, 'admin:read');
    return jsonSuccess(
      await createFriendLinks(ctx.env).adminDetail(entityIdSchema.parse(route.params.id)),
    );
  },
  PATCH: async (ctx, route) => {
    const actor = await authorizeAdminMutation(route.request, ctx.env, 'admin:write');
    const id = entityIdSchema.parse(route.params.id);
    const input = await readJsonBody(route.request, reviewSchema, 2048);
    const result = await createFriendLinks(ctx.env).review(
      id,
      input.action,
      input.expectedVersion,
      actor.id,
    );

    // 默认在 approve 时通知申请人（若未明确指定 notifyApplicant: false）
    const contactEmail = result.contactEmail;
    const shouldNotify =
      input.action === 'approve' && input.notifyApplicant !== false && Boolean(contactEmail);

    if (shouldNotify && contactEmail) {
      await ctx.defer(async () => {
        const emailService = createEmailService(ctx.env);
        const sendResult = await emailService.sendFriendLinkApproved(contactEmail, {
          applicantName: result.name,
          applicantUrl: result.canonicalUrl,
          customMessage: input.customMessage,
        });
        if (!sendResult.success) {
          console.error('[friend-link.email_failed]', {
            requestId: ctx.requestId,
            id: result.id,
            email: contactEmail,
            error: sendResult.error,
          });
        }
      });
    }

    return jsonSuccess({
      id: result.id,
      status: result.status,
      version: result.version,
      emailSent: shouldNotify && createEmailService(ctx.env).isConfigured(),
    });
  },
  DELETE: async (ctx, route) => {
    await authorizeAdminMutation(route.request, ctx.env, 'admin:write');
    const id = entityIdSchema.parse(route.params.id);
    const result = await createFriendLinks(ctx.env).delete(id);
    return jsonSuccess({
      id: result.id,
      deleted: true,
    });
  },
});

export const adminNotify = defineRestRoute({
  POST: async (ctx, route) => {
    await authorizeAdminMutation(route.request, ctx.env, 'admin:write');
    const id = entityIdSchema.parse(route.params.id);
    const input = await readJsonBody(route.request, notifySchema, 2048);
    const detail = await createFriendLinks(ctx.env).adminDetail(id);

    if (!detail.email) {
      throw new ValidationError('该友链申请未提供联系邮箱');
    }

    const emailService = createEmailService(ctx.env);
    if (!emailService.isConfigured()) {
      throw new ValidationError('邮件服务未配置 (RESEND_API_KEY 缺失)');
    }

    const sendResult = await emailService.sendFriendLinkApproved(detail.email, {
      applicantName: detail.name,
      applicantUrl: detail.url,
      customMessage: input.customMessage,
    });

    if (!sendResult.success) {
      throw new InternalServerError(sendResult.error || '邮件发送失败');
    }

    return jsonSuccess({
      sent: true,
      recipient: detail.email,
      messageId: sendResult.id,
    });
  },
});

export function screenshotRoute(scope: 'public' | 'admin') {
  return defineRestRoute({
    GET: async (ctx, route) => {
      if (scope === 'admin') await authorizeAdmin(route.request, ctx.env, 'admin:read');
      const id = entityIdSchema.parse(route.params.id);
      return createFriendLinks(ctx.env).screenshot(id, scope);
    },
  });
}

export const cleanup = defineRestRoute({
  POST: async (ctx, route) => {
    await authorizeAdminMutation(route.request, ctx.env, 'admin:maintenance');
    const input = await readJsonBody(
      route.request,
      z.object({ cursor: z.string().min(1).max(4096).optional() }).strict(),
      8192,
    );
    return jsonSuccess(await createFriendLinks(ctx.env).cleanup(input.cursor));
  },
});
