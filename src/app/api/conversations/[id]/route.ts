import { withAuthHandler } from '@/lib/api';
import { getConversation, deleteConversation } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { db } from '@/db/client';
import { messages, files } from '@/db/schema';
import { eq, asc } from 'drizzle-orm';
import type { ConversationDetailResponse } from '@/types/api';

export const GET = withAuthHandler(async (req, { user }) => {
  const id = new URL(req.url).pathname.split('/').pop()!;

  const result = await getConversation(id, user.id);
  if (!result.ok) return errorResponse(result.error);

  const convo = result.value;

  const [msgs, convoFiles] = await Promise.all([
    db.query.messages.findMany({
      where: eq(messages.conversationId, id),
      orderBy: [asc(messages.createdAt)],
    }),
    db.query.files.findMany({
      where: eq(files.conversationId, id),
    }),
  ]);

  const response: ConversationDetailResponse = {
    conversation: {
      id: convo.id,
      title: convo.title,
      updatedAt: convo.updatedAt.toISOString(),
    },
    messages: msgs.map((m) => ({
      id: m.id,
      role: m.role as 'user' | 'assistant',
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
    files: convoFiles.map((f) => ({
      id: f.id,
      fileName: f.fileName,
      fileType: f.fileType,
      columnNames: f.columnNames,
      rowCount: f.rowCount,
    })),
  };

  return Response.json(response);
});

export const DELETE = withAuthHandler(async (req, { user }) => {
  const id = new URL(req.url).pathname.split('/').pop()!;

  const result = await deleteConversation(id, user.id);
  if (!result.ok) return errorResponse(result.error);

  return new Response(null, { status: 204 });
});
