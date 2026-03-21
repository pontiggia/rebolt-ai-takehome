import type { ChatOnFinishCallback } from 'ai';
import type { AppUIMessage, ArtifactToolInput, ArtifactToolOutput } from '@/types/ai';
import type {
  ActiveArtifact,
  ArtifactRetryPayload,
  ArtifactRetrySource,
  ArtifactRuntimeEvent,
  ArtifactRuntimeState,
} from '@/types/chat';
import { ARTIFACT_DATASET_ERROR_MARKER } from '@/types/chat';

export const IDLE_RUNTIME_STATE: ArtifactRuntimeState = {
  status: 'idle',
  retryCount: 0,
  lastError: null,
  source: null,
};

export type RetryRequestResult = 'started' | 'blocked' | 'exhausted';
export type ArtifactRetryRequestPayload = Omit<ArtifactRetryPayload, 'attempt' | 'manual'>;
export type ChatFinishEvent = Parameters<ChatOnFinishCallback<AppUIMessage>>[0];

type GenerateArtifactPart = {
  type: 'tool-generateArtifact';
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
};

export interface GenerateArtifactToolError {
  readonly signature: string;
  readonly payload: ArtifactRetryRequestPayload;
}

export interface PendingRetry {
  readonly payload: ArtifactRetryPayload;
  readonly baselineArtifactKey: string | null;
}

export function normalizeErrorMessage(value: unknown, fallback: string): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }

  if (value && typeof value === 'object') {
    const errorLike = value as Partial<Record<'message' | 'title' | 'description', unknown>>;
    for (const key of ['message', 'title', 'description'] as const) {
      const candidate = errorLike[key];
      if (typeof candidate === 'string' && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return fallback;
}

export function isDatasetAccessError(error: string): boolean {
  return error.startsWith(ARTIFACT_DATASET_ERROR_MARKER);
}

export function stripDatasetAccessError(error: string): string {
  return error.replace(ARTIFACT_DATASET_ERROR_MARKER, '').trim();
}

function getGenerateArtifactPart(part: AppUIMessage['parts'][number]): GenerateArtifactPart | null {
  return part.type === 'tool-generateArtifact' ? (part as GenerateArtifactPart) : null;
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

export function toRuntimeSource(event: Exclude<ArtifactRuntimeEvent, { type: 'ready' }>): ArtifactRetrySource {
  if (event.type === 'timeout') {
    return 'sandpack-timeout';
  }

  if (event.type === 'notification-error') {
    return 'sandpack-notification';
  }

  return 'sandpack-runtime';
}

export function buildRuntimeRetryPayload(
  artifact: ActiveArtifact,
  error: string,
  source: ArtifactRetrySource,
): ArtifactRetryRequestPayload {
  return {
    assistantMessageId: artifact.assistantMessageId,
    artifactToolCallId: artifact.toolCallId,
    fileId: artifact.fileId,
    artifactTitle: artifact.title,
    artifactDescription: artifact.description,
    files: artifact.files,
    error,
    source,
  };
}

export function buildManualRetryPayload(
  artifact: ActiveArtifact,
  previousRetry: ArtifactRetryRequestPayload | null,
  runtimeState: ArtifactRuntimeState,
): ArtifactRetryRequestPayload {
  if (
    previousRetry &&
    previousRetry.assistantMessageId === artifact.assistantMessageId &&
    previousRetry.artifactToolCallId === artifact.toolCallId
  ) {
    return {
      assistantMessageId: previousRetry.assistantMessageId,
      artifactToolCallId: previousRetry.artifactToolCallId,
      fileId: previousRetry.fileId,
      artifactTitle: previousRetry.artifactTitle,
      artifactDescription: previousRetry.artifactDescription,
      files: previousRetry.files,
      error: previousRetry.error,
      source: previousRetry.source,
    };
  }

  return {
    assistantMessageId: artifact.assistantMessageId,
    artifactToolCallId: artifact.toolCallId,
    fileId: artifact.fileId,
    artifactTitle: artifact.title,
    artifactDescription: artifact.description,
    files: artifact.files,
    error: runtimeState.lastError ?? 'The artifact preview failed.',
    source: runtimeState.source ?? 'sandpack-runtime',
  };
}
