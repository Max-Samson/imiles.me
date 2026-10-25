import type { APIRoute } from 'astro';
import { cmsHistorySnapshotRoute } from '../../../../../../server/admin/cms/history-routes';

export const prerender = false;
export const ALL: APIRoute = cmsHistorySnapshotRoute;
