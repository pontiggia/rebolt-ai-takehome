import { withAuthHandler } from '@/lib/api';
import { deleteConversation, getConversationDetail } from '@/services/conversations';
import { errorResponse } from '@/types/errors';

type ConversationRouteContext = RouteContext<'/api/conversations/[id]'>;

export const GET = withAuthHandler<ConversationRouteContext>(async (_req, { user, params }) => {
  const { id } = await params;

  const result = await getConversationDetail(id, user.id);
  if (!result.ok) return errorResponse(result.error);

  return Response.json(result.value);
});

export const DELETE = withAuthHandler<ConversationRouteContext>(async (_req, { user, params }) => {
  const { id } = await params;

  const result = await deleteConversation(id, user.id);
  if (!result.ok) return errorResponse(result.error);

  return new Response(null, { status: 204 });
});
