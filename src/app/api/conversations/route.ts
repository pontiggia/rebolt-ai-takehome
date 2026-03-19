import { eq } from 'drizzle-orm';
import { parseJsonBody, withAuthHandler } from '@/lib/api';
import { listConversations } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { db } from '@/db/client';
import { conversations } from '@/db/schema';
import { createConversationBodySchema } from '@/types/api';
import { createInitialUserMessage } from '@/services/messages';
import { generateTitle } from '@/services/ai';
import { uuidv7 } from 'uuidv7';
import type { UIMessage } from 'ai';

export const GET = withAuthHandler(async (_req, { user }) => {
  const result = await listConversations(user.id);
  if (!result.ok) return errorResponse(result.error);
  return Response.json(result.value);
});

function createTextUserMessage(text: string): UIMessage {
  return {
    id: uuidv7(),
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, createConversationBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const initialMessage = parsedBody.data.initialMessage?.trim();
  const [convo] = await db.insert(conversations).values({ userId: user.id }).returning();

  let createdConversation = convo;

  if (initialMessage) {
    await createInitialUserMessage(convo.id, createTextUserMessage(initialMessage));

    try {
      const title = await generateTitle(initialMessage);
      const [updatedConversation] = await db
        .update(conversations)
        .set({ title })
        .where(eq(conversations.id, convo.id))
        .returning();

      if (updatedConversation) {
        createdConversation = updatedConversation;
      }
    } catch {
      // Fall back to the default title if title generation fails.
    }
  }

  return Response.json(createdConversation, { status: 201 });
});
