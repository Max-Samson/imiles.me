import { z } from 'astro/zod';
import { defineRestRoute, readJsonBody } from '../rest';
import {
  limitSubmission,
  requireAdmin,
  requireSameOrigin,
  verifyTurnstile,
} from '../security/friend-links';
import { createObjectStorage } from '../storage';
import { jsonSuccess } from '../types';
import { friendLinkRepository } from './repository';
import { friendLinkService } from './service';
import { readSubmission } from './upload';
import { entityIdSchema, idempotencySchema, parseListQuery, reviewSchema } from './validation';

export const publicList = defineRestRoute({
  GET: async (ctx) => {
    const query = parseListQuery(ctx.url);
    return jsonSuccess(
      await friendLinkService(
        friendLinkRepository(ctx.env),
        createObjectStorage(ctx.env),
      ).listPublished(query.page, query.pageSize),
    );
  },
});
export const submit = defineRestRoute({
  POST: async (ctx, route) => {
    requireSameOrigin(route.request, ctx.env);
    await limitSubmission(ctx);
    const key = idempotencySchema.parse(route.request.headers.get('Idempotency-Key'));
    const input = await readSubmission(route.request);
    const { created, ...receipt } = await friendLinkService(
      friendLinkRepository(ctx.env),
      createObjectStorage(ctx.env),
    ).submit(input, key, () => verifyTurnstile(input.turnstileToken, ctx.env));
    return jsonSuccess(receipt, {
      status: created ? 201 : 200,
      ...(created ? { headers: { Location: `/api/v1/admin/friend-links/${receipt.id}` } } : {}),
    });
  },
});
export const adminList = defineRestRoute({
  GET: async (ctx, route) => {
    await requireAdmin(route.request, ctx.env);
    const query = parseListQuery(ctx.url, true);
    const rows = await friendLinkRepository(ctx.env).listAdmin(
      query.page,
      query.pageSize,
      query.status,
    );
    return jsonSuccess({
      items: rows.slice(0, query.pageSize),
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: rows.length > query.pageSize,
    });
  },
});
export const adminDetail = defineRestRoute({
  GET: async (ctx, route) => {
    await requireAdmin(route.request, ctx.env);
    const row = await friendLinkRepository(ctx.env).detail(entityIdSchema.parse(route.params.id));
    return jsonSuccess({
      id: row.id,
      url: row.canonicalUrl,
      submittedUrl: row.submittedUrl,
      description: row.description,
      email: row.contactEmail,
      status: row.status,
      version: row.version,
      reviewedBy: row.reviewedBy,
      reviewedAt: row.reviewedAt,
      publishedAt: row.publishedAt,
      updatedBy: row.updatedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      screenshotUrl: row.screenshotKey ? `/api/v1/admin/friend-links/${row.id}/screenshot` : null,
    });
  },
  PATCH: async (ctx, route) => {
    requireSameOrigin(route.request, ctx.env);
    const actor = await requireAdmin(route.request, ctx.env);
    const id = entityIdSchema.parse(route.params.id);
    const input = await readJsonBody(route.request, reviewSchema, 2048);
    return jsonSuccess(
      await friendLinkRepository(ctx.env).transition(
        id,
        input.action,
        input.expectedVersion,
        actor,
      ),
    );
  },
});
export function screenshotRoute(admin: boolean) {
  return defineRestRoute({
    GET: async (ctx, route) => {
      if (admin) await requireAdmin(route.request, ctx.env);
      const id = entityIdSchema.parse(route.params.id);
      return friendLinkService(
        friendLinkRepository(ctx.env),
        createObjectStorage(ctx.env),
      ).screenshot(id, admin);
    },
  });
}
export const cleanup = defineRestRoute({
  POST: async (ctx, route) => {
    requireSameOrigin(route.request, ctx.env);
    await requireAdmin(route.request, ctx.env);
    const input = await readJsonBody(
      route.request,
      z.object({ cursor: z.string().min(1).max(4096).optional() }).strict(),
      8192,
    );
    return jsonSuccess(
      await friendLinkService(friendLinkRepository(ctx.env), createObjectStorage(ctx.env)).cleanup(
        input.cursor,
      ),
    );
  },
});
