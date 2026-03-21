import { createUIMessageStreamResponse, safeValidateUIMessages } from 'ai';
import type { Tool } from 'ai';
import { z } from 'zod/v4';
import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import { getConversation, getConversationFileData, getFileDataById } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatBodySchema } from '@/types/api';
import { buildChatModelMessages } from '@/lib/chat/build-chat-model-messages';
import { createChatUIStream } from '@/lib/chat/create-chat-ui-stream';
import { createChatTools } from '@/lib/tools';
import { syncConversationMessages } from '@/services/messages';
import type { AppUIMessage } from '@/types/ai';

const uploadedFileDataSchema = z.object({
  fileId: z.string().uuid(),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  rowCount: z.number().int().nonnegative(),
});

export const POST = withAuthHandler(async (req, { user }) => {
  const parsedBody = await parseJsonBody(req, chatBodySchema);
  if (!parsedBody.success) {
    return errorResponse(parsedBody.error);
  }

  const { conversationId, messages: rawMessages, artifactRetry } = parsedBody.data;

  const convoPromise = getConversation(conversationId, user.id);
  const filePromise = artifactRetry?.fileId
    ? getFileDataById(artifactRetry.fileId, user.id)
    : getConversationFileData(conversationId);
  const [convoResult, fileResult] = await Promise.all([convoPromise, filePromise]);

  if (!convoResult.ok) {
    return errorResponse(convoResult.error);
  }

  if (!fileResult.ok) {
    return errorResponse(fileResult.error);
  }

  const fileData = fileResult.value;
  const tools = createChatTools(fileData);
  const validatedMessages = await safeValidateUIMessages<AppUIMessage>({
    messages: rawMessages,
    dataSchemas: {
      'uploaded-file': uploadedFileDataSchema,
    },
    tools: tools as Record<string, Tool<unknown, unknown>>,
  });

  if (!validatedMessages.success) {
    return errorResponse(invalidRequestError(validatedMessages.error.message));
  }

  const messages = validatedMessages.data;
  const [, modelMessages] = await Promise.all([
    syncConversationMessages(conversationId, messages),
    buildChatModelMessages({
      messages,
      artifactRetry,
      fileData,
    }),
  ]);

  return createUIMessageStreamResponse({
    stream: createChatUIStream({
      conversationId,
      fileData,
      messages,
      modelMessages,
      tools,
    }),
  });
});
