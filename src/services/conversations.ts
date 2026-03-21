import 'server-only';

import { db } from '@/db/client';
import { conversations, files } from '@/db/schema';
import type { Conversation, FileRecord } from '@/db/schema';
import type { FileDataContext } from '@/types/file';
import type { Result } from '@/types/result';
import type { NotFoundError } from '@/types/errors';
import type { ConversationDetailResponse } from '@/types/api';
import { ok, err } from '@/types/result';
import { eq, and, desc } from 'drizzle-orm';
import { listConversationMessages } from '@/services/messages';
import { toFileDataContext } from '@/services/datasets';

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

  return ok(await toFileDataContext(file));
}

export async function getFileDataById(fileId: string, userId: string): Promise<Result<FileDataContext, NotFoundError>> {
  const file = await getOwnedFileRecord(fileId, userId);
  if (!file.ok) {
    return file;
  }

  return ok(await toFileDataContext(file.value));
}

export async function getOwnedFileRecord(fileId: string, userId: string): Promise<Result<FileRecord, NotFoundError>> {
  const file = await db.query.files.findFirst({
    where: and(eq(files.id, fileId), eq(files.userId, userId)),
  });

  if (!file) {
    return err({
      type: 'NOT_FOUND',
      resource: 'file',
      id: fileId,
    });
  }

  return ok(file);
}

export async function listConversations(userId: string): Promise<Result<Conversation[], never>> {
  const convos = await db.query.conversations.findMany({
    where: eq(conversations.userId, userId),
    orderBy: [desc(conversations.updatedAt)],
  });

  return ok(convos);
}

export async function getConversationDetail(
  conversationId: string,
  userId: string,
): Promise<Result<ConversationDetailResponse, NotFoundError>> {
  const convo = await getConversation(conversationId, userId);
  if (!convo.ok) return convo;

  const messages = await listConversationMessages(conversationId);

  return ok({
    conversation: {
      id: convo.value.id,
      title: convo.value.title,
      updatedAt: convo.value.updatedAt.toISOString(),
    },
    messages,
  });
}

export async function deleteConversation(conversationId: string, userId: string): Promise<Result<void, NotFoundError>> {
  const convo = await getConversation(conversationId, userId);
  if (!convo.ok) return convo;

  await db.delete(conversations).where(eq(conversations.id, conversationId));
  return ok(undefined);
}
