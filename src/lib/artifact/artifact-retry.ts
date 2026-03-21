import type { ChatOnFinishCallback } from 'ai';
import type { AppUIMessage } from '@/types/ai';
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
