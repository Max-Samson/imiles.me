import type { APIRoute } from 'astro';
import { cmsPublicationListRoute } from '../../../../../../server/admin/cms/routes';

export const prerender = false;
export const GET: APIRoute = cmsPublicationListRoute;
