'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { conversations } from '@/db/schema';
import { getCurrentUser } from '@/lib/auth';
import { buildUserMessageParts } from '@/lib/chat/user-message-parts';
import { createInitialUserMessage } from '@/services/messages';
import { deleteConversation as deleteConversationService } from '@/services/conversations';
import { generateTitle } from '@/services/ai';
import { uuidv7 } from 'uuidv7';
import type { AppUIMessage, UploadedFileData } from '@/types/ai';

function createUserMessage(text: string, uploadedFiles: readonly UploadedFileData[] = []): AppUIMessage {
  return {
    id: uuidv7(),
    role: 'user',
    parts: buildUserMessageParts(text, uploadedFiles),
  };
}

export async function createConversation(
  initialMessage: string,
  existingConversationId?: string,
  uploadedFiles: readonly UploadedFileData[] = [],
): Promise<{ id: string; messageId: string }> {
  const user = await getCurrentUser();
  const message = initialMessage.trim();

  if (!message || message.length > 4000) {
    throw new Error('Message must be between 1 and 4000 characters');
  }

  let conversationId: string;

  if (existingConversationId) {
    const existing = await db.query.conversations.findFirst({
      where: and(eq(conversations.id, existingConversationId), eq(conversations.userId, user.id)),
    });
    if (!existing) throw new Error('Conversation not found');
    conversationId = existingConversationId;
  } else {
    const [convo] = await db.insert(conversations).values({ userId: user.id }).returning();
    conversationId = convo.id;
  }

  const uiMessage = createUserMessage(message, uploadedFiles);

  const [, title] = await Promise.all([
    createInitialUserMessage(conversationId, uiMessage),
    generateTitle(message).catch(() => null),
  ]);

  if (title) {
    await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
  }

  revalidatePath('/chat');
  return { id: conversationId, messageId: uiMessage.id };
}

export async function createConversationOnly(): Promise<{ id: string }> {
  const user = await getCurrentUser();
  const [convo] = await db.insert(conversations).values({ userId: user.id }).returning();
  return { id: convo.id };
}

export async function removeConversation(conversationId: string): Promise<void> {
  const user = await getCurrentUser();

  const result = await deleteConversationService(conversationId, user.id);
  if (!result.ok) {
    throw new Error(`${result.error.resource} not found`);
  }

  revalidatePath('/chat');
}
