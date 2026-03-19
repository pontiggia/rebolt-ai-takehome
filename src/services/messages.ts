import 'server-only';

import type { UIMessage } from 'ai';
import { and, asc, eq, notInArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { conversations as conversationsTable, messages as messagesTable } from '@/db/schema';
import type { MessageResponse } from '@/types/api';

type DatabaseTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

function extractTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
}

function toStoredMessageValues(conversationId: string, message: UIMessage) {
  return {
    conversationId,
    uiMessageId: message.id,
    role: message.role as 'user' | 'assistant',
    content: extractTextFromParts(message.parts),
    parts: message.parts,
  };
}

async function touchConversation(tx: DatabaseTransaction, conversationId: string) {
  await tx
    .update(conversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(conversationsTable.id, conversationId));
}

export async function syncConversationMessages(conversationId: string, messages: readonly UIMessage[]) {
  await db.transaction(async (tx) => {
    const messageIds = messages.map((message) => message.id);

    if (messageIds.length > 0) {
      await tx
        .delete(messagesTable)
        .where(
          and(
            eq(messagesTable.conversationId, conversationId),
            notInArray(messagesTable.uiMessageId, messageIds),
          ),
        );
    }

    for (const message of messages) {
      const values = toStoredMessageValues(conversationId, message);

      await tx
        .insert(messagesTable)
        .values(values)
        .onConflictDoUpdate({
          target: messagesTable.uiMessageId,
          set: {
            role: values.role,
            content: values.content,
            parts: values.parts,
          },
        });
    }

    await touchConversation(tx, conversationId);
  });
}

export async function upsertConversationMessage(conversationId: string, message: UIMessage) {
  await db.transaction(async (tx) => {
    const values = toStoredMessageValues(conversationId, message);

    await tx
      .insert(messagesTable)
      .values(values)
      .onConflictDoUpdate({
        target: messagesTable.uiMessageId,
        set: {
          role: values.role,
          content: values.content,
          parts: values.parts,
        },
      });

    await touchConversation(tx, conversationId);
  });
}

export async function listConversationMessages(conversationId: string): Promise<MessageResponse[]> {
  const messages = await db.query.messages.findMany({
    where: eq(messagesTable.conversationId, conversationId),
    orderBy: [asc(messagesTable.createdAt)],
  });

  return messages.map((message) => ({
    id: message.uiMessageId,
    role: message.role as 'user' | 'assistant',
    content: message.content,
    parts: message.parts,
    createdAt: message.createdAt.toISOString(),
  }));
}

export async function createInitialUserMessage(conversationId: string, message: UIMessage) {
  await upsertConversationMessage(conversationId, message);
}
