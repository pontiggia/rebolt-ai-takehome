import type { ArtifactToolInput, ArtifactToolOutput, AppUIMessage, GenerateArtifactToolInvocation } from '@/types/ai';
import type { ActiveArtifact } from '@/types/chat';
import type { ArtifactRetryRequestPayload } from '@/lib/artifact/artifact-retry';
import { normalizeErrorMessage, shapeArtifactRetryError } from '@/lib/artifact/artifact-retry';
import { findLatestGenerateArtifactErrorPart } from '@/lib/artifact/find-latest-generate-artifact-error';
import { isArtifactStaticValidationError } from '@/lib/tools/artifact-static-validator';

export interface GenerateArtifactToolError {
  readonly signature: string;
  readonly payload: ArtifactRetryRequestPayload;
}

export function getArtifactKey(assistantMessageId: string, toolCallId: string): string {
  return `${assistantMessageId}:${toolCallId}`;
}

function getGenerateArtifactPart(part: AppUIMessage['parts'][number]): GenerateArtifactToolInvocation | null {
  return part.type === 'tool-generateArtifact' ? part : null;
}

function toActiveArtifact(messageId: string, part: GenerateArtifactToolInvocation): ActiveArtifact | null {
  if (part.state !== 'output-available' || !part.output) {
    return null;
  }

  const output = part.output as ArtifactToolOutput;
  const input = part.input as ArtifactToolInput | undefined;

  return {
    key: getArtifactKey(messageId, part.toolCallId),
    assistantMessageId: messageId,
    toolCallId: part.toolCallId,
    fileId: output.fileId ?? null,
    datasetUrl: output.datasetUrl ?? null,
    usesReboltAI: typeof output.usesReboltAI === 'boolean' ? output.usesReboltAI : (input?.useReboltAI ?? false),
    title: output.title ?? input?.title ?? null,
    description: input?.description ?? null,
    files: output.files,
  };
}

export function findLatestSuccessfulArtifact(messages: readonly AppUIMessage[]): ActiveArtifact | null {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];
    if (message.role !== 'assistant') {
      continue;
    }

    for (let partIndex = message.parts.length - 1; partIndex >= 0; partIndex -= 1) {
      const part = getGenerateArtifactPart(message.parts[partIndex]);
      if (!part) {
        continue;
      }

      const artifact = toActiveArtifact(message.id, part);
      if (artifact) {
        return artifact;
      }
    }
  }

  return null;
}

export function listSuccessfulArtifactKeys(messages: readonly AppUIMessage[]): string[] {
  const keys: string[] = [];

  for (const message of messages) {
    if (message.role !== 'assistant') {
      continue;
    }

    for (const part of message.parts) {
      const artifactPart = getGenerateArtifactPart(part);
      const artifact = artifactPart ? toActiveArtifact(message.id, artifactPart) : null;
      if (artifact) {
        keys.push(artifact.key);
      }
    }
  }

  return keys;
}

export function findLatestGenerateArtifactToolError(
  messages: readonly AppUIMessage[],
  fallbackFileId: string | null,
): GenerateArtifactToolError | null {
  const latestError = findLatestGenerateArtifactErrorPart(messages, {
    getRole: (message) => message.role,
    getParts: (message) => message.parts,
    getGenerateArtifactPart,
  });

  if (!latestError) {
    return null;
  }

  const message = latestError.message;
  const part = latestError.part as GenerateArtifactToolInvocation;
  const error = normalizeErrorMessage(latestError.errorText, 'Artifact generation failed.');
  const source = isArtifactStaticValidationError(error) ? 'artifact-static-validation' : 'tool-output-error';
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
      error: shapeArtifactRetryError(error, source),
      source,
    },
  };

}
