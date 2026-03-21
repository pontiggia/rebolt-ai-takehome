import type { ArtifactToolInput, ArtifactToolOutput, AppUIMessage, GenerateArtifactToolInvocation } from '@/types/ai';
import type { ActiveArtifact } from '@/types/chat';
import type { ArtifactRetryRequestPayload } from '@/lib/artifact/artifact-retry';
import { normalizeErrorMessage } from '@/lib/artifact/artifact-retry';

export interface GenerateArtifactToolError {
  readonly signature: string;
  readonly payload: ArtifactRetryRequestPayload;
}

function getGenerateArtifactPart(part: AppUIMessage['parts'][number]): GenerateArtifactToolInvocation | null {
  return part.type === 'tool-generateArtifact' ? part : null;
}

export function findLatestSuccessfulArtifact(messages: readonly AppUIMessage[]): ActiveArtifact | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = getGenerateArtifactPart(message.parts[partIndex]);
      if (!part || part.state !== 'output-available' || !part.output) {
        continue;
      }

      const output = part.output as ArtifactToolOutput;
      const input = part.input as ArtifactToolInput | undefined;
      return {
        key: `${message.id}:${part.toolCallId}`,
        assistantMessageId: message.id,
        toolCallId: part.toolCallId,
        fileId: output.fileId ?? null,
        title: output.title ?? input?.title ?? null,
        description: input?.description ?? null,
        files: output.files,
      };
    }
  }

  return null;
}

export function findLatestGenerateArtifactToolError(
  messages: readonly AppUIMessage[],
  fallbackFileId: string | null,
): GenerateArtifactToolError | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = getGenerateArtifactPart(message.parts[partIndex]);
      if (!part || part.state !== 'output-error' || !part.errorText) {
        continue;
      }

      const error = normalizeErrorMessage(part.errorText, 'Artifact generation failed.');
      const input = part.input as ArtifactToolInput | undefined;
      return {
        signature: `${message.id}:${part.toolCallId}:${error}`,
        payload: {
          assistantMessageId: message.id,
          artifactToolCallId: part.toolCallId,
          fileId: fallbackFileId,
          artifactTitle: input?.title ?? null,
          artifactDescription: input?.description ?? null,
          files: null,
          error,
          source: 'tool-output-error',
        },
      };
    }
  }

  return null;
}
