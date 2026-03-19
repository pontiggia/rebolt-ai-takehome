import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText } from 'ai';
import type { UIMessage } from 'ai';
import type { Tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { getConversation, getConversationFileData } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatBodySchema } from '@/types/api';
import { buildAnalysisPrompt } from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import { AI_MODELS } from '@/types/ai';
import { syncConversationMessages, upsertConversationMessage } from '@/services/messages';
import { uuidv7 } from 'uuidv7';

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, chatBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId, messages: rawMessages } = parsedBody.data;

  const [convoResult, fileResult] = await Promise.all([
    getConversation(conversationId, user.id),
    getConversationFileData(conversationId),
  ]);

  if (!convoResult.ok) return errorResponse(convoResult.error);

  const fileData = fileResult.ok ? fileResult.value : null;
  const tools = createChatTools(fileData);
  const validatedMessages = await safeValidateUIMessages<UIMessage>({
    messages: rawMessages,
    tools: tools as Record<string, Tool<unknown, unknown>>,
  });

  if (!validatedMessages.success) {
    return errorResponse(invalidRequestError(validatedMessages.error.message));
  }

  const messages = validatedMessages.data;
  await syncConversationMessages(conversationId, messages);

  const result = streamText({
    model: openai(AI_MODELS.analysis),
    system: buildAnalysisPrompt(fileData),
    messages: await convertToModelMessages(messages),
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(3),
    tools,
  });

  return result.toUIMessageStreamResponse<UIMessage>({
    originalMessages: messages,
    generateMessageId: () => uuidv7(),
    onFinish: async ({ isAborted, responseMessage }) => {
      if (isAborted || responseMessage.parts.length === 0) {
        return;
      }

      await upsertConversationMessage(conversationId, responseMessage);
    },
  });
});
