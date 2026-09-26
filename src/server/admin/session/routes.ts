import { defineRestRoute } from '../../rest';
import { getAdminAccess } from '../../security/access';
import { jsonSuccess } from '../../types';

export const adminSessionRoute = defineRestRoute({
  GET: async (context, route) => {
    return jsonSuccess(await getAdminAccess(route.request, context.env), undefined, {
      requestId: context.requestId,
    });
  },
});
