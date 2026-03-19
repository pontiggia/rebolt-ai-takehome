import { db } from '@/db/client';
import { messages as messagesTable, conversations as conversationsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type { Result } from '@/types/result';
import { ok } from '@/types/result';

export async function persistChatExchange(
  conversationId: string,
  userMessage: string,
  assistantResponse: string,
): Promise<Result<void, never>> {
  await db.transaction(async (tx) => {
    await tx.insert(messagesTable).values({
      conversationId,
      role: 'user',
      content: userMessage,
    });

    await tx.insert(messagesTable).values({
      conversationId,
      role: 'assistant',
      content: assistantResponse,
    });

    await tx.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, conversationId));
  });

  return ok(undefined);
}
