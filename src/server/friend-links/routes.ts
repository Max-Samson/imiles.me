import { z } from 'astro/zod';
import { defineRestRoute, readJsonBody } from '../rest';
import { authorizeAdmin, authorizeAdminMutation } from '../security/access';
import { requireSameOrigin } from '../security/origin';
import { createObjectStorage } from '../storage';
import { jsonSuccess } from '../types';
import { limitSubmission, verifyTurnstile } from './protection';
import { friendLinkRepository } from './repository';
import { friendLinkService } from './service';
import { readSubmission } from './upload';
import { entityIdSchema, idempotencySchema, parseListQuery, reviewSchema } from './validation';

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
    return jsonSuccess(
      await createFriendLinks(ctx.env).review(id, input.action, input.expectedVersion, actor.id),
    );
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
