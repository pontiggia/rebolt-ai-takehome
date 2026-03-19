import { streamText, stepCountIs } from 'ai';
import { openai } from '@ai-sdk/openai';
import { withAuthHandler } from '@/lib/api';
import { getConversation, getConversationFileData } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatRequestSchema } from '@/types/api';
import { buildAnalysisPrompt } from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import { AI_MODELS } from '@/types/ai';

export const POST = withAuthHandler(async (req, { user }) => {
  const body = chatRequestSchema.parse(await req.json());
  const { messages, conversationId } = body;

  const [convoResult, fileResult] = await Promise.all([
    getConversation(conversationId, user.id),
    getConversationFileData(conversationId),
  ]);

  if (!convoResult.ok) return errorResponse(convoResult.error);

  const fileData = fileResult.ok ? fileResult.value : null;

  const result = streamText({
    model: openai(AI_MODELS.analysis),
    system: buildAnalysisPrompt(fileData),
    messages,
    maxOutputTokens: 4096,
    stopWhen: stepCountIs(3),
    tools: createChatTools(fileData),
  });

  return result.toUIMessageStreamResponse();
});
