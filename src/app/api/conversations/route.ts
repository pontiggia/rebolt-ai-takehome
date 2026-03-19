import { withAuthHandler } from '@/lib/api';
import { listConversations } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { db } from '@/db/client';
import { conversations } from '@/db/schema';

export const GET = withAuthHandler(async (_req, { user }) => {
  const result = await listConversations(user.id);
  if (!result.ok) return errorResponse(result.error);
  return Response.json(result.value);
});

export const POST = withAuthHandler(async (_req, { user }) => {
  const [convo] = await db.insert(conversations).values({ userId: user.id }).returning();

  return Response.json(convo, { status: 201 });
});
