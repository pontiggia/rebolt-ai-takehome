import 'server-only';

import { createUIMessageStream, stepCountIs, streamText } from 'ai';
import type { ModelMessage } from 'ai';
import { openai } from '@ai-sdk/openai';
import { uuidv7 } from 'uuidv7';
import { getStepActivityId, getToolActivityId } from '@/lib/agent-activity';
import { buildAnalysisPrompt } from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import {
  createActivityReporter,
  createStepFinishActivity,
  createStepStartActivity,
  createToolFinishActivity,
  createToolStartActivity,
  getChatErrorMessage,
} from '@/lib/chat/chat-stream-activity';
import { upsertConversationMessage } from '@/services/messages';
import { AI_MODELS, type AppAIExecutionContext, type AppToolName, type AppUIMessage } from '@/types/ai';
import type { FileDataContext } from '@/types/file';

interface CreateChatUIStreamOptions {
  readonly conversationId: string;
  readonly fileData: FileDataContext | null;
  readonly messages: readonly AppUIMessage[];
  readonly modelMessages: ModelMessage[];
  readonly tools: ReturnType<typeof createChatTools>;
}

export function createChatUIStream({
  conversationId,
  fileData,
  messages,
  modelMessages,
  tools,
}: CreateChatUIStreamOptions) {
  return createUIMessageStream<AppUIMessage>({
    originalMessages: [...messages],
    generateId: uuidv7,
    onError: getChatErrorMessage,
    onFinish: async ({ isAborted, responseMessage }) => {
      if (isAborted || responseMessage.parts.length === 0) {
        return;
      }

      await upsertConversationMessage(conversationId, responseMessage);
    },
    execute: ({ writer }) => {
      const reportActivity = createActivityReporter((chunk) => writer.write(chunk));
      const executionContext: AppAIExecutionContext = { reportActivity };
      const result = streamText({
        model: openai(AI_MODELS.analysis),
        system: buildAnalysisPrompt(fileData),
        messages: modelMessages,
        maxOutputTokens: 4096,
        // Artifact requests often spend 3 steps on analyze -> inspect -> generate,
        // so we need extra headroom for the assistant's final natural-language summary.
        stopWhen: stepCountIs(5),
        tools,
        experimental_context: executionContext,
        experimental_onStepStart: (event) => {
          reportActivity({
            id: getStepActivityId(event.stepNumber + 1),
            activity: createStepStartActivity(event.stepNumber + 1, event.steps.length),
          });
        },
        experimental_onToolCallStart: (event) => {
          const toolName = event.toolCall.toolName as AppToolName;
          reportActivity({
            id: getToolActivityId(event.toolCall.toolCallId),
            activity: createToolStartActivity(toolName, event.toolCall.toolCallId, event.toolCall.input),
          });
        },
        experimental_onToolCallFinish: (event) => {
          const toolName = event.toolCall.toolName as AppToolName;
          reportActivity({
            id: getToolActivityId(event.toolCall.toolCallId),
            activity: createToolFinishActivity(
              toolName,
              event.toolCall.toolCallId,
              event.success ? { success: true, output: event.output } : { success: false, error: event.error },
            ),
          });
        },
        onStepFinish: (event) => {
          const toolNames = event.toolCalls
            .map((toolCall) => toolCall.toolName)
            .filter(
              (toolName): toolName is AppToolName =>
                toolName === 'analyzeData' || toolName === 'readDatasetRows' || toolName === 'generateArtifact',
            );

          reportActivity({
            id: getStepActivityId(event.stepNumber + 1),
            activity: createStepFinishActivity(event.stepNumber + 1, event.text, event.reasoningText, toolNames),
          });
        },
      });

      writer.merge(
        result.toUIMessageStream<AppUIMessage>({
          onError: getChatErrorMessage,
        }),
      );
    },
  });
}
