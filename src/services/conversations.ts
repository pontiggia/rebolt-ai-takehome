import { db } from '@/db/client';
import { conversations, files } from '@/db/schema';
import type { Conversation } from '@/db/schema';
import type { FileDataContext } from '@/types/file';
import type { Result } from '@/types/result';
import type { NotFoundError } from '@/types/errors';
import { ok, err } from '@/types/result';
import { eq, and, desc } from 'drizzle-orm';

export async function getConversation(
  conversationId: string,
  userId: string,
): Promise<Result<Conversation, NotFoundError>> {
  const convo = await db.query.conversations.findFirst({
    where: and(eq(conversations.id, conversationId), eq(conversations.userId, userId)),
  });

  if (!convo) {
    return err({
      type: 'NOT_FOUND',
      resource: 'conversation',
      id: conversationId,
    });
  }

  return ok(convo);
}

export async function getConversationFileData(conversationId: string): Promise<Result<FileDataContext | null, never>> {
  const file = await db.query.files.findFirst({
    where: eq(files.conversationId, conversationId),
    orderBy: [desc(files.createdAt)],
  });

  if (!file) return ok(null);

  return ok({
    fileName: file.fileName,
    columnNames: file.columnNames,
    rowCount: file.rowCount,
    sampleData: file.sampleData,
  });
}

export async function listConversations(userId: string): Promise<Result<Conversation[], never>> {
  const convos = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    orderBy: [desc(conversations.updatedAt)],
  });

  return ok(convos);
}

export async function deleteConversation(conversationId: string, userId: string): Promise<Result<void, NotFoundError>> {
  const convo = await getConversation(conversationId, userId);
  if (!convo.ok) return convo;

  await db.delete(conversations).where(eq(conversations.id, conversationId));
  return ok(undefined);
}
