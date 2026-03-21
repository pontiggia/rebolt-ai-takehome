import 'server-only';

import { convertToModelMessages } from 'ai';
import type { ModelMessage, UserModelMessage } from 'ai';
import { buildArtifactRetryMessage, type ArtifactRetryDataContext } from '@/lib/system-prompt';
import type { ChatBody } from '@/types/api';
import type { AppUIMessage } from '@/types/ai';
import type { FileDataContext } from '@/types/file';

interface BuildChatModelMessagesOptions {
  readonly messages: readonly AppUIMessage[];
  readonly artifactRetry?: ChatBody['artifactRetry'];
  readonly fileData: FileDataContext | null;
}

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

function createArtifactRetryMessage(
  artifactRetry: NonNullable<BuildChatModelMessagesOptions['artifactRetry']>,
  messages: readonly AppUIMessage[],
  fileData: FileDataContext | null,
): UserModelMessage {
  return {
    role: 'user',
    content: [
      {
        type: 'text',
        text: buildArtifactRetryMessage(
          artifactRetry,
          getLatestUserTextMessage(messages),
          createArtifactRetryDataContext(fileData),
        ),
      },
    ],
  };
}

export async function buildChatModelMessages({
  messages,
  artifactRetry,
  fileData,
}: BuildChatModelMessagesOptions): Promise<ModelMessage[]> {
  const modelMessagesPromise = convertToModelMessages([...messages]);

  if (!artifactRetry) {
    return modelMessagesPromise;
  }

  const retryMessage = createArtifactRetryMessage(artifactRetry, messages, fileData);
  const modelMessages = await modelMessagesPromise;
  modelMessages.push(retryMessage);
  return modelMessages;
}
