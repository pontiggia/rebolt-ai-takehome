import { convertToModelMessages, safeValidateUIMessages, stepCountIs, streamText } from 'ai';
import type { UIMessage } from 'ai';
import type { Tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { getConversation, getConversationFileData } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatBodySchema } from '@/types/api';
import {
  buildAnalysisPrompt,
  buildArtifactRetryMessage,
  type ArtifactRetryDataContext,
} from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import { AI_MODELS } from '@/types/ai';
import { syncConversationMessages, upsertConversationMessage } from '@/services/messages';
import { uuidv7 } from 'uuidv7';
import type { FileDataContext } from '@/types/file';

function extractTextFromParts(parts: UIMessage['parts']): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
}

function getLatestUserTextMessage(messages: readonly UIMessage[]): string | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'user') {
      continue;
    }

    const text = extractTextFromParts(message.parts);
    if (text.length > 0) {
      return text;
    }
  }

  return null;
}

function createArtifactRetryDataContext(fileData: FileDataContext | null): ArtifactRetryDataContext | null {
  if (!fileData) {
    return null;
  }

  return {
    fileName: fileData.fileName,
    columnNames: fileData.columnNames,
    rowCount: fileData.rowCount,
    sampleRowCount: fileData.sampleData.length,
  };
}

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, chatBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId, messages: rawMessages, artifactRetry } = parsedBody.data;

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

  const modelMessages = await convertToModelMessages(messages);
  if (artifactRetry) {
    const originalUserRequest = getLatestUserTextMessage(messages);
    const retryDataContext = createArtifactRetryDataContext(fileData);

    modelMessages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: buildArtifactRetryMessage(artifactRetry, originalUserRequest, retryDataContext),
        },
      ],
    } as (typeof modelMessages)[number]);
  }

  const result = streamText({
    model: openai(AI_MODELS.analysis),
    system: buildAnalysisPrompt(fileData),
    messages: modelMessages,
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(3),
    tools,
  });

  return result.toUIMessageStreamResponse<UIMessage>({
    originalMessages: messages,
    generateMessageId: () => uuidv7(),
    onError: (error) => (error instanceof Error ? error.message : 'Failed to generate the chat response.'),
    onFinish: async ({ isAborted, responseMessage }) => {
      if (isAborted || responseMessage.parts.length === 0) {
        return;
      }

      await upsertConversationMessage(conversationId, responseMessage);
    },
  });
});
