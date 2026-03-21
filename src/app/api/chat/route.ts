import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
  safeValidateUIMessages,
  stepCountIs,
  streamText,
} from 'ai';
import type { Tool } from 'ai';
import { openai } from '@ai-sdk/openai';
import { invalidRequestError, parseJsonBody, withAuthHandler } from '@/lib/api';
import {
  createAgentActivityChunk,
  describeToolInput,
  describeToolSuccess,
  getStepActivityId,
  getStepLabel,
  getToolActivityId,
  getToolLabel,
} from '@/lib/agent-activity';
import { getConversation, getConversationFileData, getFileDataById } from '@/services/conversations';
import { errorResponse } from '@/types/errors';
import { chatBodySchema } from '@/types/api';
import { buildAnalysisPrompt, buildArtifactRetryMessage, type ArtifactRetryDataContext } from '@/lib/system-prompt';
import { createChatTools } from '@/lib/tools';
import type {
  AgentActivityData,
  AgentActivityReporter,
  AppAIExecutionContext,
  AppToolName,
  AppUIMessage,
} from '@/types/ai';
import { AI_MODELS } from '@/types/ai';
import { syncConversationMessages, upsertConversationMessage } from '@/services/messages';
import { uuidv7 } from 'uuidv7';
import type { FileDataContext } from '@/types/file';

function extractTextFromParts(parts: AppUIMessage['parts']): string {
  return parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
}

function getLatestUserTextMessage(messages: readonly AppUIMessage[]): string | null {
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

function getChatErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to generate the chat response.';
}

function createStepStartActivity(stepNumber: number, previousStepCount: number): AgentActivityData {
  return {
    kind: 'step',
    status: 'running',
    label: previousStepCount === 0 ? 'Thinking' : 'Planning the next move',
    stepNumber,
  };
}

function summarizeStepCompletion(
  stepText: string,
  reasoningText: string | undefined,
  toolNames: readonly AppToolName[],
): string {
  if (toolNames.length === 1) {
    return `Used ${getToolLabel(toolNames[0]).toLowerCase()}`;
  }

  if (toolNames.length > 1) {
    return `Used ${toolNames.length} tools`;
  }

  if (stepText.trim().length > 0) {
    return 'Drafted response for the user';
  }

  if (reasoningText?.trim().length) {
    return 'Completed reasoning';
  }

  return 'Step completed';
}

function createStepFinishActivity(
  stepNumber: number,
  stepText: string,
  reasoningText: string | undefined,
  toolNames: readonly AppToolName[],
): AgentActivityData {
  return {
    kind: 'step',
    status: 'completed',
    label: getStepLabel(stepNumber),
    detail: summarizeStepCompletion(stepText, reasoningText, toolNames),
    stepNumber,
  };
}

function createToolStartActivity(toolName: AppToolName, toolCallId: string, input: unknown): AgentActivityData {
  return {
    kind: 'tool',
    status: 'running',
    label: getToolLabel(toolName),
    detail: describeToolInput(toolName, input),
    toolName,
    toolCallId,
  };
}

function createToolFinishActivity(
  toolName: AppToolName,
  toolCallId: string,
  result: { success: true; output: unknown } | { success: false; error: unknown },
): AgentActivityData {
  return {
    kind: 'tool',
    status: result.success ? 'completed' : 'error',
    label: getToolLabel(toolName),
    detail: result.success ? describeToolSuccess(toolName, result.output) : getChatErrorMessage(result.error),
    toolName,
    toolCallId,
  };
}

function createActivityReporter(
  write: (event: ReturnType<typeof createAgentActivityChunk>) => void,
): AgentActivityReporter {
  return ({ id, activity, transient }) => {
    write(createAgentActivityChunk(id, activity, { transient }));
  };
}

function createArtifactRetryDataContext(fileData: FileDataContext | null): ArtifactRetryDataContext | null {
  if (!fileData) {
    return null;
  }

  return {
    fileId: fileData.fileId,
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

  const convoResult = await getConversation(conversationId, user.id);

  if (!convoResult.ok) return errorResponse(convoResult.error);

  const fileResult = artifactRetry?.fileId
    ? await getFileDataById(artifactRetry.fileId, user.id)
    : await getConversationFileData(conversationId);
  if (!fileResult.ok) return errorResponse(fileResult.error);

  const fileData = fileResult.value;
  const tools = createChatTools(fileData);
  const validatedMessages = await safeValidateUIMessages<AppUIMessage>({
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

  const uiStream = createUIMessageStream<AppUIMessage>({
    originalMessages: messages,
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
        stopWhen: stepCountIs(3),
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

  return createUIMessageStreamResponse({
    stream: uiStream,
  });
});
