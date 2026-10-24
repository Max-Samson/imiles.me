import type { APIRoute } from 'astro';
import { cmsPublicationVerifyRoute } from '../../../../../../../server/admin/cms/routes';

export const prerender = false;
export const POST: APIRoute = cmsPublicationVerifyRoute;
